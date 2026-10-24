const test = require('node:test');
const assert = require('node:assert/strict');
const AnalyticsLogic = require('../js/student-analytics-logic.js');

test('buildStudentAnalytics computes chronological progression timeline and rolling average', () => {
  const sessions = [
    { id: 's1', student_key: 'ali', student_name: 'علي الكواري', assignment_id: 'a1', score: 60, finished_at: '2026-10-10T08:00:00Z' },
    { id: 's2', student_key: 'ali', student_name: 'علي الكواري', assignment_id: 'a1', score: 80, finished_at: '2026-10-11T08:00:00Z' },
    { id: 's3', student_key: 'ali', student_name: 'علي الكواري', assignment_id: 'a2', score: 100, finished_at: '2026-10-12T08:00:00Z' },
    { id: 'g1', mode: 'group', score: 95, finished_at: '2026-10-12T09:00:00Z' } // group session must be excluded
  ];
  const assignments = [
    { id: 'a1', title: 'تحدي العلوم' },
    { id: 'a2', title: 'تحدي الرياضيات' }
  ];

  const out = AnalyticsLogic.buildStudentAnalytics({ sessions, assignments });
  assert.equal(out.isDemo, false);
  assert.equal(out.realCount, 3);
  assert.equal(out.progressionTimeline.length, 3);
  assert.deepEqual(
    out.progressionTimeline.map(x => x.rollingAverage),
    [60, 70, 80]
  );
  assert.equal(out.studentComparison.length, 1);
  assert.equal(out.studentComparison[0].firstScore, 60);
  assert.equal(out.studentComparison[0].latestScore, 100);
  assert.equal(out.studentComparison[0].improvement, 40);
  assert.equal(out.summary.overallAverage, 80);
  assert.equal(out.summary.averageImprovement, 40);
  assert.equal(out.summary.masteryRate, 67);
});

test('empty analytics never substitutes fictional students or results', () => {
  for(const forceDemo of [undefined,true,false]){
    const out=AnalyticsLogic.buildStudentAnalytics({sessions:[],forceDemo});
    assert.equal(out.isDemo,false);assert.equal(out.progressionTimeline.length,0);
    assert.equal(out.studentComparison.length,0);assert.equal(out.summary.totalCompleted,0);
  }
});
