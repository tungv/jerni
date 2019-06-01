local event = ARGV[1];
local counter = redis.call('INCR', KEYS[1]);

redis.call('HSET', KEYS[2], counter, event);
redis.call('SADD', KEYS[3], counter);
redis.call('INCR', KEYS[4]);
redis.call('PUBLISH', ARGV[2]..'::events', counter .. ':' .. event);
return counter;