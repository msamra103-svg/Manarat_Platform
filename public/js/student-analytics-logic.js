(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ManaratAnalyticsLogic = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEMO_SESSIONS = [
    { id: 'd1', student_key: 'st-rashid', student_name: 'راشد الكواري', assignment_id: 'demo-foot', game_title: 'كرة القدم 3D — العلوم', mode: 'individual', score: 58, finished_at: '2026-10-15T08:10:00Z', created_at: '2026-10-15T08:00:00Z' },
    { id: 'd2', student_key: 'st-tamim', student_name: 'تميم الهاجري', assignment_id: 'demo-foot', game_title: 'كرة القدم 3D — العلوم', mode: 'individual', score: 65, finished_at: '2026-10-15T09:15:00Z', created_at: '2026-10-15T09:00:00Z' },
    { id: 'd3', student_key: 'st-jassim', student_name: 'جاسم المري', assignment_id: 'demo-race', game_title: 'سباق السيارات — الرياضيات', mode: 'home', score: 62, finished_at: '2026-10-16T14:20:00Z', created_at: '2026-10-16T14:05:00Z' },
    { id: 'd4', student_key: 'st-rashid', student_name: 'راشد الكواري', assignment_id: 'demo-race', game_title: 'سباق السيارات — الرياضيات', mode: 'home', score: 74, finished_at: '2026-10-17T15:00:00Z', created_at: '2026-10-17T14:45:00Z' },
    { id: 'd5', student_key: 'st-khalid', student_name: 'خالد الدوسري', assignment_id: 'demo-volley', game_title: 'الكرة الطائرة — اللغة العربية', mode: 'individual', score: 70, finished_at: '2026-10-18T08:30:00Z', created_at: '2026-10-18T08:15:00Z' },
    { id: 'd6', student_key: 'st-tamim', student_name: 'تميم الهاجري', assignment_id: 'demo-volley', game_title: 'الكرة الطائرة — اللغة العربية', mode: 'individual', score: 82, finished_at: '2026-10-18T10:00:00Z', created_at: '2026-10-18T09:45:00Z' },
    { id: 'd7', student_key: 'st-jassim', student_name: 'جاسم المري', assignment_id: 'demo-bowl', game_title: 'البولينج 3D — الفيزياء', mode: 'home', score: 79, finished_at: '2026-10-19T16:10:00Z', created_at: '2026-10-19T15:55:00Z' },
    { id: 'd8', student_key: 'st-rashid', student_name: 'راشد الكواري', assignment_id: 'demo-bowl', game_title: 'البولينج 3D — الفيزياء', mode: 'individual', score: 88, finished_at: '2026-10-20T08:40:00Z', created_at: '2026-10-20T08:25:00Z' },
    { id: 'd9', student_key: 'st-khalid', student_name: 'خالد الدوسري', assignment_id: 'demo-foot', game_title: 'كرة القدم 3D — العلوم', mode: 'home', score: 86, finished_at: '2026-10-21T17:00:00Z', created_at: '2026-10-21T16:45:00Z' },
    { id: 'd10', student_key: 'st-tamim', student_name: 'تميم الهاجري', assignment_id: 'demo-bowl', game_title: 'البولينج 3D — الفيزياء', mode: 'individual', score: 94, finished_at: '2026-10-22T08:20:00Z', created_at: '2026-10-22T08:05:00Z' },
    { id: 'd11', student_key: 'st-jassim', student_name: 'جاسم المري', assignment_id: 'demo-foot', game_title: 'كرة القدم 3D — العلوم', mode: 'individual', score: 91, finished_at: '2026-10-22T09:30:00Z', created_at: '2026-10-22T09:15:00Z' },
    { id: 'd12', student_key: 'st-rashid', student_name: 'راشد الكواري', assignment_id: 'demo-volley', game_title: 'الكرة الطائرة — اللغة العربية', mode: 'individual', score: 96, finished_at: '2026-10-22T10:15:00Z', created_at: '2026-10-22T10:00:00Z' }
  ];

  function clampScore(val) {
    const n = Number(val);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function formatShortDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate();
  }

  function normalizeRecords(rawSessions = [], assignments = [], games = []) {
    const assignmentMap = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach(a => {
      if (a && a.id != null) assignmentMap.set(String(a.id), a);
    });
    const gameMap = new Map();
    (Array.isArray(games) ? games : []).forEach(g => {
      if (g && g.id != null) gameMap.set(String(g.id), g);
    });

    const valid = [];
    (Array.isArray(rawSessions) ? rawSessions : []).forEach((s, idx) => {
      if (!s || s.mode === 'group') return;
      const hasScore = s.score !== null && s.score !== undefined && s.score !== '';
      if (!hasScore) return;
      const score = clampScore(s.score);
      const studentName = String(s.student_name || 'طالب').trim() || 'طالب';
      const studentKey = String(s.student_key || studentName).trim().toLowerCase();
      const assign = s.assignment_id ? assignmentMap.get(String(s.assignment_id)) : null;
      const gameId = s.game_id || (assign && assign.game_id) || '';
      const game = gameId ? gameMap.get(String(gameId)) : null;
      const taskId = String(s.assignment_id || s.game_id || 'general');
      const taskTitle = String(
        s.game_title ||
        (assign && assign.title) ||
        (game && game.title) ||
        'مهمة تعليمية'
      ).trim();
      const timestamp = Date.parse(s.finished_at || s.created_at || '') || (1700000000000 + idx * 60000);
      const isoDate = s.finished_at || s.created_at || new Date(timestamp).toISOString();

      valid.push({
        id: String(s.id || ('att-' + idx)),
        studentKey,
        studentName,
        taskId,
        taskTitle,
        mode: s.mode === 'home' ? 'home' : 'individual',
        score,
        timestamp,
        isoDate,
        shortDate: formatShortDate(isoDate)
      });
    });

    valid.sort((a, b) => a.timestamp - b.timestamp);
    return valid;
  }

  function buildStudentAnalytics(input = {}) {
    const assignments = Array.isArray(input.assignments) ? input.assignments : [];
    const games = Array.isArray(input.games) ? input.games : [];
    const realRecords = normalizeRecords(input.sessions || input.attempts || [], assignments, games);
    const useDemo = input.forceDemo === true || (input.forceDemo !== false && realRecords.length === 0);
    const baseRecords = useDemo ? normalizeRecords(DEMO_SESSIONS, [], []) : realRecords;

    const studentsMap = new Map();
    const tasksMap = new Map();
    baseRecords.forEach(r => {
      if (!studentsMap.has(r.studentKey)) {
        studentsMap.set(r.studentKey, { key: r.studentKey, name: r.studentName });
      }
      if (!tasksMap.has(r.taskId)) {
        tasksMap.set(r.taskId, { id: r.taskId, title: r.taskTitle });
      }
    });

    const studentFilter = String(input.studentFilter || '').trim().toLowerCase();
    const taskFilter = String(input.taskFilter || '').trim();

    const filtered = baseRecords.filter(r => {
      if (studentFilter && r.studentKey !== studentFilter) return false;
      if (taskFilter && r.taskId !== taskFilter) return false;
      return true;
    });

    // 1. Chronological progression timeline with rolling average (window = 3)
    const progressionTimeline = filtered.map((r, index) => {
      const windowSlice = filtered.slice(Math.max(0, index - 2), index + 1);
      const rollingAverage = Math.round(
        windowSlice.reduce((sum, item) => sum + item.score, 0) / windowSlice.length
      );
      return {
        index: index + 1,
        attemptLabel: `محاولة ${index + 1}` + (r.shortDate ? ` (${r.shortDate})` : ''),
        studentName: r.studentName,
        taskTitle: r.taskTitle,
        score: r.score,
        rollingAverage,
        passingThreshold: 70,
        modeLabel: r.mode === 'home' ? 'واجب منزلي' : 'نشاط صفي'
      };
    });

    // 2. Per-student progression comparison (First score vs Latest score vs Best score)
    const groupedByStudent = new Map();
    filtered.forEach(r => {
      if (!groupedByStudent.has(r.studentKey)) {
        groupedByStudent.set(r.studentKey, []);
      }
      groupedByStudent.get(r.studentKey).push(r);
    });

    const studentComparison = [];
    for (const [key, list] of groupedByStudent.entries()) {
      const firstScore = list[0].score;
      const latestScore = list[list.length - 1].score;
      const bestScore = Math.max(...list.map(x => x.score));
      const averageScore = Math.round(list.reduce((s, x) => s + x.score, 0) / list.length);
      const improvement = latestScore - firstScore;
      studentComparison.push({
        studentKey: key,
        studentName: list[list.length - 1].studentName,
        firstScore,
        latestScore,
        bestScore,
        averageScore,
        improvement,
        attemptsCount: list.length
      });
    }
    studentComparison.sort((a, b) => b.latestScore - a.latestScore);

    // 3. Breakdown by educational game / assignment
    const groupedByTask = new Map();
    filtered.forEach(r => {
      if (!groupedByTask.has(r.taskId)) {
        groupedByTask.set(r.taskId, { id: r.taskId, title: r.taskTitle, list: [] });
      }
      groupedByTask.get(r.taskId).list.push(r);
    });

    const gameMastery = [];
    for (const [, group] of groupedByTask.entries()) {
      const count = group.list.length;
      const avg = Math.round(group.list.reduce((s, x) => s + x.score, 0) / count);
      const passed = group.list.filter(x => x.score >= 70).length;
      const passRate = Math.round((passed * 100) / count);
      gameMastery.push({
        taskId: group.id,
        taskTitle: group.title,
        averageScore: avg,
        passRate,
        attemptsCount: count
      });
    }

    // 4. Overall KPI summary metrics
    const totalCompleted = filtered.length;
    const uniqueStudents = studentComparison.length;
    const overallAverage = totalCompleted
      ? Math.round(filtered.reduce((s, x) => s + x.score, 0) / totalCompleted)
      : 0;
    const multiAttemptStudents = studentComparison.filter(s => s.attemptsCount > 1);
    const averageImprovement = multiAttemptStudents.length
      ? Math.round(
          multiAttemptStudents.reduce((s, x) => s + x.improvement, 0) / multiAttemptStudents.length
        )
      : (studentComparison[0]?.improvement || 0);
    const masteryRate = totalCompleted
      ? Math.round((filtered.filter(x => x.score >= 70).length * 100) / totalCompleted)
      : 0;

    return {
      isDemo: useDemo,
      realCount: realRecords.length,
      students: [...studentsMap.values()],
      tasks: [...tasksMap.values()],
      progressionTimeline,
      studentComparison,
      gameMastery,
      summary: {
        totalCompleted,
        uniqueStudents,
        overallAverage,
        averageImprovement,
        masteryRate
      }
    };
  }

  return {
    DEMO_SESSIONS,
    clampScore,
    normalizeRecords,
    buildStudentAnalytics
  };
});
