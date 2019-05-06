if redis.call('exists', KEYS[1]) == 0 then
  return {0, 0}
end
local last = tonumber(redis.call('get', KEYS[1]))
local numberOfTypes = tonumber(ARGV[1]);

local to = tonumber(
  ARGV[3] or last
);
local from = tonumber(ARGV[2]) + 1;
local newArray = {};
local event

if numberOfTypes == 0 then
  for id=from,to do
    if redis.call('hexists', KEYS[2], id) == 1 then
      table.insert(newArray, {id, redis.call('hget', KEYS[2], id)});
    end
  end

  return {to, last, unpack(newArray)};
end


for id=from,to do
  local matches = false
  for keyIndex=1,numberOfTypes do 
    if (redis.call('SISMEMBER', KEYS[2 + keyIndex], id) == 1) then
      matches = true;
      break;
    end
  end

  if matches == true then
    table.insert(newArray, {id, redis.call('hget', KEYS[2], id)});
  end
end

return {to, last, unpack(newArray)}