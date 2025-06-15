require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const userRoutes = require('./routes/user');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/', (req, res) => {
  res.json({ message: 'Server töötab!' });
});

app.use('/user', userRoutes);

app.listen(3000, () => {
  console.log('Server kuulab pordil 3000');
}); 