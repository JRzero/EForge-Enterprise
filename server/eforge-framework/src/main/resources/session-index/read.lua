-- Metadata lives in the same key as membership. Missing is never complete empty.
local metadata = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', '0', 'WITHSCORES')
local revision = cjson.encode(metadata)
if #metadata ~= 2 or not string.match(metadata[1], '^m:%x+$') or metadata[2] ~= '-1' then
    return {'0', revision}
end
if redis.call('ZCARD', KEYS[1]) > tonumber(ARGV[1]) + 1 then return {'0', revision} end
local now = redis.call('TIME')
local millis = tonumber(now[1]) * 1000 + math.floor(tonumber(now[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, millis)
local members = redis.call('ZRANGEBYSCORE', KEYS[1], 1, '+inf')
local result = {'1', revision}
for _, member in ipairs(members) do
    if string.sub(member, 1, 2) ~= 't:' then return {'0', revision} end
    table.insert(result, string.sub(member, 3))
end
return result
