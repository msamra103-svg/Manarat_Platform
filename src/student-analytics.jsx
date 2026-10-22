import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ComposedChart,
  BarChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import AnalyticsLogic from '../js/student-analytics-logic.js';

const rootsMap = new WeakMap();

function useContainerWidth(defaultWidth = 820) {
  const ref = useRef(null);
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w && w > 200) {
        setWidth(Math.max(260, Math.floor(w - 8)));
      }
    };
    update();
    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  return [ref, width];
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const record = payload[0]?.payload || {};
  return (
    <div
      style={{
        background: '#1f191d',
        color: '#f8f6f4',
        border: '1px solid rgba(212, 175, 55, 0.45)',
        borderRadius: '12px',
        padding: '10px 14px',
        fontSize: '13px',
        lineHeight: 1.6,
        boxShadow: '0 12px 28px rgba(0,0,0,0.28)',
        direction: 'rtl',
        textAlign: 'right'
      }}
    >
      <div style={{ fontWeight: 800, color: '#f6c85f', marginBottom: '4px' }}>
        {label || record.studentName || record.taskTitle}
      </div>
      {record.studentName && label !== record.studentName && (
        <div style={{ fontSize: '12px', color: '#e2d9de' }}>
          الطالب: <b>{record.studentName}</b>
        </div>
      )}
      {record.taskTitle && label !== record.taskTitle && (
        <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
          اللعبة / المهمة: {record.taskTitle} ({record.modeLabel || 'فردي'})
        </div>
      )}
      {payload.map((entry, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              display: 'inline-block',
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: entry.color || '#8a1538'
            }}
          />
          <span>{entry.name}:</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{entry.value}%</strong>
        </div>
      ))}
    </div>
  );
}

function StudentProgressionDashboard({ sessions = [], assignments = [], games = [], initialTaskFilter = '' }) {
  const [chartType, setChartType] = useState('progression'); // 'progression' | 'students' | 'games'
  const [studentFilter, setStudentFilter] = useState('');
  const [taskFilter, setTaskFilter] = useState(initialTaskFilter || '');
  const [forceDemo, setForceDemo] = useState(null);
  const [chartRef, chartWidth] = useContainerWidth(820);

  useEffect(() => {
    if (initialTaskFilter !== undefined) {
      setTaskFilter(initialTaskFilter || '');
    }
  }, [initialTaskFilter]);

  const analytics = useMemo(() => {
    return AnalyticsLogic.buildStudentAnalytics({
      sessions,
      assignments,
      games,
      studentFilter,
      taskFilter,
      forceDemo
    });
  }, [sessions, assignments, games, studentFilter, taskFilter, forceDemo]);

  const { summary, progressionTimeline, studentComparison, gameMastery, students, tasks, isDemo, realCount } = analytics;
  const sign = summary.averageImprovement > 0 ? '+' : '';

  return (
    <section
      className="card student-analytics-card"
      data-testid="recharts-student-analytics"
      style={{
        marginTop: '18px',
        marginBottom: '22px',
        padding: '22px',
        borderRadius: '18px',
        border: '1px solid rgba(138, 21, 56, 0.16)',
        background: 'linear-gradient(180deg, rgba(138, 21, 56, 0.035), rgba(255, 255, 255, 0.96))',
        direction: 'rtl'
      }}
    >
      <div
        className="section-head"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px',
          marginBottom: '16px'
        }}
      >
        <div>
          <span
            className="tag"
            style={{
              display: 'inline-block',
              marginBottom: '6px',
              background: isDemo ? 'rgba(217, 119, 6, 0.14)' : 'rgba(22, 101, 52, 0.14)',
              color: isDemo ? '#b45309' : '#166534',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          >
            {isDemo
              ? '📊 بيانات تدريبية توضيحية (تتحول تلقائيًا لنتائج طلابك فور إكمال أول محاولة)'
              : `✅ بيانات فعلية مباشرة (${summary.totalCompleted} محاولة مكتملة)`}
          </span>
          <h2 style={{ margin: '4px 0 6px', fontSize: '22px' }}>
            تحليلات تطور مستوى الطلاب في الألعاب التعليمية (Recharts)
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
            تتبّع منحنى التعلّم عبر المحاولات المتتالية، وقارن بين أول محاولة وأحدث محاولة لكل طالب.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {realCount > 0 && (
            <button
              type="button"
              className="button quiet"
              data-testid="toggle-demo-analytics"
              onClick={() => setForceDemo(prev => (prev === true ? false : true))}
              style={{ fontSize: '13px', padding: '7px 12px' }}
            >
              {isDemo ? 'عرض بيانات طلابي الفعلية' : 'معاينة بيانات تدريبية'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div
        className="analytics-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
          marginBottom: '18px'
        }}
      >
        <div className="card stat" style={{ padding: '14px 16px', margin: 0 }}>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>متوسط الدرجات العام</span>
          <b
            data-testid="kpi-overall-average"
            style={{ display: 'block', fontSize: '26px', color: '#8a1538', fontVariantNumeric: 'tabular-nums' }}
          >
            {summary.overallAverage}%
          </b>
        </div>
        <div className="card stat" style={{ padding: '14px 16px', margin: 0 }}>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>متوسط تطور المستوى</span>
          <b
            data-testid="kpi-average-improvement"
            style={{
              display: 'block',
              fontSize: '26px',
              color: summary.averageImprovement >= 0 ? '#15803d' : '#b91c1c',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {sign}{summary.averageImprovement}%
          </b>
        </div>
        <div className="card stat" style={{ padding: '14px 16px', margin: 0 }}>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>نسبة الإتقان (≥ 70%)</span>
          <b
            data-testid="kpi-mastery-rate"
            style={{ display: 'block', fontSize: '26px', color: '#0369a1', fontVariantNumeric: 'tabular-nums' }}
          >
            {summary.masteryRate}%
          </b>
        </div>
        <div className="card stat" style={{ padding: '14px 16px', margin: 0 }}>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>الطلاب المشاركون</span>
          <b
            data-testid="kpi-unique-students"
            style={{ display: 'block', fontSize: '26px', fontVariantNumeric: 'tabular-nums' }}
          >
            {summary.uniqueStudents} طالب
          </b>
        </div>
      </div>

      {/* Interactive Filter & View Bar */}
      <div
        className="analytics-controls-bar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '14px',
          borderBottom: '1px solid rgba(138, 21, 56, 0.12)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="tablist" aria-label="نوع الرسم البياني">
          {[
            { id: 'progression', label: '📈 منحنى تطور المستوى' },
            { id: 'students', label: '👨‍🎓 مقارنة تقدم الطلاب' },
            { id: 'games', label: '🎮 الإتقان حسب اللعبة' }
          ].map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={chartType === item.id}
              data-testid={`chart-tab-${item.id}`}
              className={chartType === item.id ? 'active' : 'quiet'}
              onClick={() => setChartType(item.id)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                background: chartType === item.id ? '#8a1538' : 'rgba(138, 21, 56, 0.08)',
                color: chartType === item.id ? '#ffffff' : 'inherit',
                border: '1px solid rgba(138, 21, 56, 0.2)'
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select
            aria-label="تصفية حسب الطالب"
            data-testid="analytics-student-select"
            value={studentFilter}
            onChange={e => setStudentFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '170px', margin: 0, padding: '7px 12px', fontSize: '13.5px' }}
          >
            <option value="">كل الطلاب ({students.length})</option>
            {students.map(s => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            aria-label="تصفية حسب اللعبة أو المهمة"
            data-testid="analytics-task-select"
            value={taskFilter}
            onChange={e => setTaskFilter(e.target.value)}
            style={{ width: 'auto', minWidth: '185px', margin: 0, padding: '7px 12px', fontSize: '13.5px' }}
          >
            <option value="">كل الألعاب والمهمات ({tasks.length})</option>
            {tasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Recharts Canvas Viewport */}
      <div
        ref={chartRef}
        className="recharts-viewport-box"
        style={{
          width: '100%',
          minHeight: '340px',
          direction: 'ltr',
          overflowX: 'auto'
        }}
      >
        {chartType === 'progression' && (
          <ComposedChart
            width={chartWidth}
            height={330}
            data={progressionTimeline}
            margin={{ top: 14, right: 24, left: 4, bottom: 12 }}
          >
            <defs>
              <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8a1538" stopOpacity={0.34} />
                <stop offset="95%" stopColor="#8a1538" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(138, 21, 56, 0.13)" />
            <XAxis dataKey="attemptLabel" tick={{ fontSize: 12, fill: '#475569' }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#475569' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }} />
            <ReferenceLine
              y={70}
              stroke="#15803d"
              strokeDasharray="5 5"
              label={{ value: 'حد الإتقان 70%', position: 'insideTopRight', fill: '#15803d', fontSize: 12 }}
            />
            <Area
              type="monotone"
              dataKey="score"
              name="درجة المحاولة"
              stroke="#8a1538"
              strokeWidth={2.5}
              fill="url(#scoreAreaGrad)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="rollingAverage"
              name="المتوسط التراكمي للتطور"
              stroke="#d97706"
              strokeWidth={3}
              dot={{ r: 4, fill: '#d97706' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}

        {chartType === 'students' && (
          <BarChart
            width={chartWidth}
            height={330}
            data={studentComparison}
            margin={{ top: 14, right: 24, left: 4, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(138, 21, 56, 0.13)" />
            <XAxis dataKey="studentName" tick={{ fontSize: 12, fill: '#475569' }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#475569' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }} />
            <ReferenceLine y={70} stroke="#15803d" strokeDasharray="4 4" />
            <Bar
              dataKey="firstScore"
              name="أول محاولة"
              fill="#94a3b8"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="latestScore"
              name="أحدث محاولة"
              fill="#8a1538"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="bestScore"
              name="أعلى درجة"
              fill="#d97706"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        )}

        {chartType === 'games' && (
          <ComposedChart
            width={chartWidth}
            height={330}
            data={gameMastery}
            margin={{ top: 14, right: 24, left: 4, bottom: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(138, 21, 56, 0.13)" />
            <XAxis dataKey="taskTitle" tick={{ fontSize: 12, fill: '#475569' }} />
            <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#475569' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '8px' }} />
            <Bar
              dataKey="averageScore"
              name="متوسط الدرجات"
              fill="#8a1538"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="passRate"
              name="نسبة الاجتياز"
              stroke="#15803d"
              strokeWidth={3}
              dot={{ r: 5, fill: '#15803d' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        )}
      </div>

      {/* Student Improvement Summary Pills */}
      {studentComparison.length > 0 && (
        <div
          style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(138, 21, 56, 0.1)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <small style={{ fontWeight: 700, opacity: 0.75 }}>ملخص تطور الطلاب:</small>
          {studentComparison.slice(0, 6).map(st => (
            <span
              key={st.studentKey}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12.5px',
                background: 'rgba(138, 21, 56, 0.06)',
                border: '1px solid rgba(138, 21, 56, 0.14)'
              }}
            >
              <b>{st.studentName}</b>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {st.firstScore}% ← {st.latestScore}%
              </span>
              <strong
                style={{
                  color: st.improvement >= 0 ? '#15803d' : '#b91c1c',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                ({st.improvement >= 0 ? `+${st.improvement}%` : `${st.improvement}%`})
              </strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function mount(containerOrId, props = {}) {
  const container =
    typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  if (!container) return null;
  let root = rootsMap.get(container);
  if (!root) {
    root = createRoot(container);
    rootsMap.set(container, root);
  }
  root.render(<StudentProgressionDashboard {...props} />);
  return root;
}

function unmount(containerOrId) {
  const container =
    typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
  if (!container) return;
  const root = rootsMap.get(container);
  if (root) {
    root.unmount();
    rootsMap.delete(container);
  }
}

if (typeof window !== 'undefined') {
  window.ManaratAnalyticsLogic = AnalyticsLogic;
  window.ManaratStudentAnalytics = { mount, unmount };
}

export { mount, unmount, StudentProgressionDashboard };
