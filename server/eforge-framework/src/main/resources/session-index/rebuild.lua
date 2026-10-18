-- ARGV: captured metadata revision, new unique metadata member, token/remaining-TTL pairs.
local metadata = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', '0', 'WITHSCORES')
if cjson.encode(metadata) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
redis.call('ZADD', KEYS[1], -2, ARGV[2])
local now = redis.call('TIME')
local millis = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
local latest = millis + 300000
for i = 3, #ARGV, 2 do
    -- A captured TTL can only overestimate expiry after the scan, never omit a live token.
    local expires = millis + tonumber(ARGV[i + 1])
    redis.call('ZADD', KEYS[1], expires, ARGV[i])
    if expires > latest then latest = expires end
end
redis.call('PEXPIREAT', KEYS[1], latest + 1000)
redis.call('ZADD', KEYS[1], -1, ARGV[2])
return 1
