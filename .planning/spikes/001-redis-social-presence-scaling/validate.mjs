import assert from "node:assert/strict";

const PRESENCE_TTL_MS = 60_000;
const TYPING_TTL_MS = 5_000;
const TYPING_MIN_REFRESH_MS = 2_000;
const UNKNOWN_GRACE_MS = 15_000;

class Clock {
  now = 0;
  advance(ms) { this.now += ms; }
}

class TtlStore {
  constructor(clock) { this.clock = clock; this.values = new Map(); }
  set(key, value, ttl) { this.values.set(key, { value, expiresAt: this.clock.now + ttl }); }
  get(key) {
    const item = this.values.get(key);
    if (!item || item.expiresAt <= this.clock.now) {
      this.values.delete(key);
      return undefined;
    }
    return item.value;
  }
  has(key) { return this.get(key) !== undefined; }
}

function presenceKey(userId, sessionId) {
  return `presence:${userId}:${sessionId}`;
}

function typingKey(conversationId, userId) {
  return `typing:${conversationId}:${userId}`;
}

function heartbeat(store, clock, userId, sessionId, activity = "idle") {
  store.set(presenceKey(userId, sessionId), { userId, activity, at: clock.now }, PRESENCE_TTL_MS);
}

function onlineSessions(store, userId, sessionIds) {
  return sessionIds.filter((sessionId) => store.has(presenceKey(userId, sessionId)));
}

function setTyping(store, clock, state, conversationId, userId) {
  const key = typingKey(conversationId, userId);
  const previous = state.lastUpdateAt.get(key);
  if (previous !== undefined && clock.now - previous < TYPING_MIN_REFRESH_MS) return false;
  state.lastUpdateAt.set(key, clock.now);
  store.set(key, true, TYPING_TTL_MS);
  return true;
}

function snapshotPresence({ redisAvailable, lastKnownAt, now, active }) {
  if (redisAvailable) return active ? "online" : "offline";
  return now - lastKnownAt <= UNKNOWN_GRACE_MS ? "last_known" : "unknown";
}

function batchEvents(events, batchSize) {
  const batches = [];
  for (let index = 0; index < events.length; index += batchSize) batches.push(events.slice(index, index + batchSize));
  return batches;
}

function canReadPresence({ acceptedFriend, blocked }) {
  return acceptedFriend && !blocked;
}

function canReadTyping({ conversationParticipant }) {
  return conversationParticipant;
}

const clock = new Clock();
const store = new TtlStore(clock);
const user = "u-1";
const sessions = ["browser", "phone"];

heartbeat(store, clock, user, sessions[0], "studying");
heartbeat(store, clock, user, sessions[1], "chatting");
assert.deepEqual(onlineSessions(store, user, sessions), sessions, "any live session keeps user online");

clock.advance(PRESENCE_TTL_MS - 1);
assert.deepEqual(onlineSessions(store, user, sessions), sessions, "presence remains live before TTL");
clock.advance(1);
assert.deepEqual(onlineSessions(store, user, sessions), [], "presence expires after TTL");

const typingState = { lastUpdateAt: new Map() };
assert.equal(setTyping(store, clock, typingState, "c-1", user), true, "first typing event accepted");
assert.equal(setTyping(store, clock, typingState, "c-1", user), false, "typing throttle rejects rapid refresh");
clock.advance(TYPING_MIN_REFRESH_MS);
assert.equal(setTyping(store, clock, typingState, "c-1", user), true, "typing refresh accepted after throttle");
clock.advance(TYPING_TTL_MS);
assert.equal(store.has(typingKey("c-1", user)), false, "typing expires by TTL");

const activityEvents = Array.from({ length: 120 }, (_, index) => ({ id: index }));
const batches = batchEvents(activityEvents, 30);
assert.equal(batches.length, 4, "activity uses bounded batches");
assert.ok(batches.length < activityEvents.length, "batching reduces durable write count");

const lastKnownAt = clock.now;
assert.equal(snapshotPresence({ redisAvailable: false, lastKnownAt, now: lastKnownAt, active: true }), "last_known");
assert.equal(snapshotPresence({ redisAvailable: false, lastKnownAt, now: lastKnownAt + UNKNOWN_GRACE_MS + 1, active: true }), "unknown");
assert.equal(snapshotPresence({ redisAvailable: true, lastKnownAt, now: lastKnownAt, active: false }), "offline");
assert.equal(canReadPresence({ acceptedFriend: true, blocked: false }), true, "accepted friends can read presence");
assert.equal(canReadPresence({ acceptedFriend: true, blocked: true }), false, "blocked users cannot read presence");
assert.equal(canReadTyping({ conversationParticipant: true }), true, "conversation participants can read typing");
assert.equal(canReadTyping({ conversationParticipant: false }), false, "non-participants cannot read typing");

console.log("SPIKE PASS: TTLs, multi-session presence, typing throttle, batching, failure, and privacy semantics");
