-- KEYS: unchanged login key, internal user index. ARGV: operation, bytes/expected,
-- replacement/TTL, threshold, unique revision, token member, force-incomplete.
local operation = ARGV[1]
local ttl
if operation == 'create' then
    if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
    ttl = tonumber(ARGV[3])
elseif operation == 'cas' then
    local current = redis.call('GET', KEYS[1])
    if not current or current ~= ARGV[2] then return 0 end
    ttl = redis.call('PTTL', KEYS[1])
    if ttl <= 0 then return 0 end
elseif operation == 'renew' then
    ttl = redis.call('PTTL', KEYS[1])
    if ttl <= 0 then return ttl end
    if ttl > tonumber(ARGV[4]) then return ttl end
    ttl = tonumber(ARGV[3])
else
    return redis.error_reply('Invalid session index operation')
end
local metadata = redis.call('ZRANGEBYSCORE', KEYS[2], '-inf', '0', 'WITHSCORES')
local complete = #metadata == 2 and string.match(metadata[1], '^m:%x+$') and metadata[2] == '-1' and ARGV[7] ~= '1'
-- Invalidate before any fallible token write. Redis script errors do not undo writes.
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', '0')
redis.call('ZADD', KEYS[2], -2, ARGV[5])
if operation == 'create' then
    redis.call('SET', KEYS[1], ARGV[2], 'PX', ttl)
elseif operation == 'cas' then
    redis.call('SET', KEYS[1], ARGV[3], 'PX', ttl)
else
    redis.call('PEXPIRE', KEYS[1], ttl)
end
local expires = redis.call('PEXPIRETIME', KEYS[1])
local now = redis.call('TIME')
local millis = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[2], 0, millis)
redis.call('ZADD', KEYS[2], expires, ARGV[6])
local latest = redis.call('ZREVRANGE', KEYS[2], 0, 0, 'WITHSCORES')
redis.call('PEXPIREAT', KEYS[2], tonumber(latest[2]) + 1000)
if complete then redis.call('ZADD', KEYS[2], -1, ARGV[5]) end
if operation == 'renew' then return ttl end
return 1
