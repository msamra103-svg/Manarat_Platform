const test = require('node:test');
const assert = require('node:assert/strict');
const hub = require('../js/homepage-hub-logic.js');

test('YouTube video with UUID DB id is recognized by URL', () => {
  const rec=hub.normalizeVideoEntry({id:'00000000-0000-4000-8000-000000001234',url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',title:'درس'},'الإدارة');
  assert.ok(rec,'video should not disappear because id is a UUID');
  assert.equal(rec.youtubeId,'dQw4w9WgXcQ');
  assert.equal(rec.kind,'youtube');
});
test('Video list removes duplicates and honors explicit hidden flags', () => {
  const items=hub.mergePublicVideos({settingsVideos:[{url:'https://youtu.be/dQw4w9WgXcQ',title:'درس'}, {url:'https://youtu.be/dQw4w9WgXcQ',title:'مكرر'}, {url:'https://youtu.be/dQw4w9WgXcQ',visible:false}], platformVideos:[]});
  assert.equal(items.length,1);
  assert.equal(items[0].title,'درس');
});
test('Weekly student champion slots stay one per grade with no fabricated winners', () => {
  const result=hub.computeWeeklyRankings({sessions:[],assignments:[],teachers:[],games:[],now:'2026-10-22T09:00:00Z'});
  assert.equal(result.champions.length,3);
  assert.equal(result.champions.filter(s=>s.hasWinner).length,0);
});
