# Skaleeritavus ja ID Genereerimine

## Praegune olukord

Äpp kasutab praegu lihtsat ID genereerimise süsteemi, mis **EI ole valmis miljoni kasutajaga**:

### Probleemid:
- Mock data kasutab lihtsaid ID'd (`'1'`, `'2'`, `'3'`)
- `Math.random()` pole krüptograafiliselt turvaline
- Puudub keskne ID koordineerimine
- Local storage ei skaleeru

## Lahendused miljoni kasutaja jaoks

### 1. Turvaline ID Genereerimine

```typescript
// Halb (praegune)
id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Hea (uus süsteem)
import { generateMessageId } from '@/utils/idGenerator';
id: generateMessageId() // msg-lkj2h3-ios-A7x9K2mP
```

### 2. UUID Standardid

**UUIDv4 format**: `550e8400-e29b-41d4-a716-446655440000`
- 128-bit unikaalsus
- 2^122 võimalikku kombinatsiooni
- Collision risk: praktiliselt null

### 3. Andmebaasi Skaleeritavus

#### Praegu:
```typescript
// Local storage - ei skaleeru
const messages = { [planId]: ChatMessage[] }
```

#### Produktsioon:
```typescript
// Distributed database
- PostgreSQL + sharding
- MongoDB + replica sets  
- Redis cache layer
- CDN static content'ile
```

### 4. Arhitektuur Miljoni Kasutajaga

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   API Gateway   │────│  Microservices  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Message Queue │────│   Database      │
                       │   (Redis/RabbitMQ)│   │   (Sharded)     │
                       └─────────────────┘    └─────────────────┘
```

## Implementeerimine

### 1. ID Generaatori Kasutamine

```typescript
// store/chatStore.ts
import { generateMessageId, generatePlanId } from '@/utils/idGenerator';

sendMessage: (planId, messageData) => {
  const newMessage: ChatMessage = {
    ...messageData,
    id: generateMessageId(), // Turvaline ID
    timestamp: Date.now(),
    reactions: {},
    isRead: false,
  };
  // ...
}
```

### 2. Andmebaasi Migratsioon

```sql
-- PostgreSQL näide
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_plan_created (plan_id, created_at)
);

-- Sharding key: plan_id
-- Partition by: created_at (monthly)
```

### 3. Cache Strateegia

```typescript
// Redis cache
const getCachedMessages = async (planId: string) => {
  const cached = await redis.get(`messages:${planId}`);
  if (cached) return JSON.parse(cached);
  
  const messages = await db.getMessages(planId);
  await redis.setex(`messages:${planId}`, 300, JSON.stringify(messages));
  return messages;
};
```

## Performance Optimisatsioonid

### 1. Lazy Loading
```typescript
// Laadi ainult viimased 50 sõnumit
const getRecentMessages = (planId: string, limit = 50) => {
  return db.messages
    .where('plan_id', planId)
    .orderBy('created_at', 'desc')
    .limit(limit);
};
```

### 2. Pagination
```typescript
const getMessagesPaginated = (planId: string, cursor?: string) => {
  let query = db.messages.where('plan_id', planId);
  
  if (cursor) {
    query = query.where('created_at', '<', cursor);
  }
  
  return query.orderBy('created_at', 'desc').limit(20);
};
```

### 3. Real-time Updates
```typescript
// WebSocket connection
const subscribeToMessages = (planId: string) => {
  socket.join(`plan:${planId}`);
  
  socket.on('new_message', (message) => {
    // Update local state
    updateMessages(planId, message);
  });
};
```

## Turvalisus

### 1. Rate Limiting
```typescript
// Max 10 sõnumit minutis kasutaja kohta
const rateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each user to 10 requests per windowMs
  keyGenerator: (req) => req.user.id
});
```

### 2. Input Validation
```typescript
const validateMessage = (content: string): boolean => {
  return content.length > 0 && content.length <= 1000;
};
```

### 3. Encryption
```typescript
// End-to-end encryption
const encryptMessage = (content: string, publicKey: string) => {
  return crypto.encrypt(content, publicKey);
};
```

## Monitoring ja Analytics

### 1. Metrics
- Messages per second
- Database query time
- Cache hit ratio
- Error rates

### 2. Alerting
- High error rates
- Database connection issues
- Memory usage spikes

## Kokkuvõte

**Praegune süsteem**: Sobib testimiseks ja väikeseks kasutajaskonnaks

**Miljoni kasutaja jaoks vaja**:
1. ✅ Turvaline ID genereerimine (loodud)
2. 🔄 Distributed database
3. 🔄 Microservices arhitektuur  
4. 🔄 Caching layer
5. 🔄 Load balancing
6. 🔄 Real-time messaging
7. 🔄 Monitoring & alerting

**Järgmised sammud**:
1. Implementeeri uus ID generator
2. Migreeeri andmebaasile
3. Lisa cache layer
4. Seadista monitoring 