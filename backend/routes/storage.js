const express = require('express');
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middleware/verifyToken');

const router = express.Router();
const supabase = global.supabase;

// Use memory storage; files are uploaded straight to Supabase
const upload = multer({ storage: multer.memoryStorage() });

async function ensureAvatarsBucket() {
  try {
    const { data: bucket, error: getError } = await supabase.storage.getBucket('avatars');
    if (!bucket) {
      const { error: createError } = await supabase.storage.createBucket('avatars', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
      });
      if (createError) {
        console.log('Could not create avatars bucket:', createError.message);
      }
    }
  } catch (e) {
    console.log('ensureAvatarsBucket failed (continuing):', e.message);
  }
}

// POST /api/storage/avatar
router.post('/avatar', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });
    await ensureAvatarsBucket();

    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const ext = path.extname(file.originalname || '').replace('.', '') || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const storagePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype || `image/${ext}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath);

    return res.json({ url: publicUrl, path: storagePath });
  } catch (error) {
    console.error('Avatar upload server error:', error);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;


