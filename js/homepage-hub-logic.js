/* Pure logic for Homepage Rotating Showcase, Weekly Qatar Rankings, and Public Video Gallery */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ManaratHomepageHub = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+03:00 (Asia/Qatar has no DST)

  const GAME_CATALOG = {
    football: {
      key: 'football',
      name: 'كرة القدم',
      badge: 'ملعب ثلاثي الأبعاد',
      eyebrow: 'تحدّي الملاعب التفاعلي',
      headline: 'مرّر بذكاء، أجب بدقة، وسجّل هدف الفوز',
      pitch: 'واجه حارس المرمى في بيئة ثلاثية الأبعاد وحوّل كل إجابة صحيحة إلى هجمة متقنة.',
      cover: 'assets/game-covers/football.svg',
      playableDemo: true
    },
    volleyball: {
      key: 'volleyball',
      name: 'الكرة الطائرة',
      badge: 'تداول 6×6',
      eyebrow: 'تحدّي الصالة الرياضية',
      headline: 'استقبل، أعدّ الكرة، واضرب ساحقًا بالمعرفة',
      pitch: 'تبادل الكرات فوق الشبكة مع فريقك وتقدّم في الأشواط عبر الإجابات المتتالية.',
      cover: 'assets/game-covers/volleyball.svg',
      playableDemo: true
    },
    basketball: {
      key: 'basketball',
      name: 'كرة السلة',
      badge: 'صالة 3D',
      eyebrow: 'تحدّي الرميات الحاسمة',
      headline: 'صوّب رميتك الثلاثية نحو السلة بإجاباتك الصحيحة',
      pitch: 'تحكّم في زاوية التصويب والتوقيت بعد كل سؤال علمي أو مهاري تجيب عنه بنجاح.',
      cover: 'assets/game-covers/basketball.svg',
      playableDemo: true
    },
    race: {
      key: 'race',
      name: 'سباق السيارات',
      badge: 'حلبة سباق 3D',
      eyebrow: 'حلبة السرعة والتركيز',
      headline: 'انطلق في المضمار وتجاوز الحواجز المعرفية',
      pitch: 'قد سيارتك على الحلبة وافتح بوابات العبور نحو خط النهاية مع كل إجابة متقنة.',
      cover: 'assets/game-covers/race.svg',
      playableDemo: true
    },
    bowling: {
      key: 'bowling',
      name: 'البولينج',
      badge: 'فيزياء 10 قوارير',
      eyebrow: 'دقة التصويب والتركيز',
      headline: 'اضبط الزاوية والدوران وأسقط القوارير العشر',
      pitch: 'محاكاة فيزيائية واقعية تكافئ إجابتك الصحيحة برمية مثالية على مضمار البولينج.',
      cover: 'assets/game-covers/bowling.svg',
      playableDemo: true
    },
    fishing: {
      key: 'fishing',
      name: 'صيد الأسماك',
      badge: 'بيئة بحرية 3D',
      eyebrow: 'مغامرة الأعماق المعرفية',
      headline: 'راقب حركة الأسماك تحت الماء واصطد الإجابة الصحيحة',
      pitch: 'تجربة هادئة ومركّزة تجمع دقة الملاحظة واستحضار المعلومة في بيئة مائية تفاعلية.',
      cover: 'assets/game-covers/fishing.svg',
      playableDemo: true
    },
    classic: {
      key: 'classic',
      name: 'تحدّي المعرفة',
      badge: 'مسابقة تفاعلية',
      eyebrow: 'المسابقة المدرسية الشاملة',
      headline: 'اختبر سرعة البديهة والفهم العميق في جميع المواد',
      pitch: 'تحدٍّ معرفي مباشر يدعم الأسئلة الموضوعية والمقالية والمطابقة والترتيب والتصنيف.',
      cover: 'assets/game-covers/classic.svg',
      playableDemo: true
    },
    puzzle: {
      key: 'puzzle',
      name: 'بازل الصور',
      badge: 'تركيب الصور',
      eyebrow: 'التفكير البصري والتحليل',
      headline: 'ركّب أجزاء الصورة التعليمية واكتشف المفهوم الكامل',
      pitch: 'تحدٍّ بصري تفاعلي لتجميع الخرائط والرسوم العلمية والصور التعليمية داخل المهمات.',
      cover: 'assets/game-covers/puzzle.svg',
      playableDemo: false
    }
  };

  const GRADE_META = {
    '7': {
      grade: '7',
      title: 'نجم الصف السابع',
      gradeLabel: 'الصف السابع',
      badge: 'المستوى السابع',
      emptyPrompt: 'من سيكون نجم الصف السابع هذا الأسبوع؟',
      emptySubtext: 'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف السابع.'
    },
    '8': {
      grade: '8',
      title: 'نجم الصف الثامن',
      gradeLabel: 'الصف الثامن',
      badge: 'المستوى الثامن',
      emptyPrompt: 'من سيكون نجم الصف الثامن هذا الأسبوع؟',
      emptySubtext: 'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف الثامن.'
    },
    '9': {
      grade: '9',
      title: 'نجم الصف التاسع',
      gradeLabel: 'الصف التاسع',
      badge: 'المستوى التاسع',
      emptyPrompt: 'من سيكون نجم الصف التاسع هذا الأسبوع؟',
      emptySubtext: 'أكمل مهماتك التعليمية بدقة لتتصدر لوحة الشرف الأسبوعية للصف التاسع.'
    }
  };

  function toArabicDigits(value) {
    return String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  }

  function normalizeArabicText(value) {
    return toArabicDigits(String(value ?? ''))
      .trim()
      .normalize('NFKC')
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .toLowerCase();
  }

  /**
   * Computes Sunday 00:00:00.000 to Saturday 23:59:59.999 in Asia/Qatar (UTC+3).
   */
  function getQatarWeekBounds(nowInput) {
    const nowDate = nowInput ? new Date(nowInput) : new Date();
    const nowMs = Number.isFinite(nowDate.getTime()) ? nowDate.getTime() : Date.now();
    const qatarNow = new Date(nowMs + QATAR_OFFSET_MS);

    const dayOfWeek = qatarNow.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const qatarYear = qatarNow.getUTCFullYear();
    const qatarMonth = qatarNow.getUTCMonth();
    const qatarDate = qatarNow.getUTCDate();

    const startQatarUtcMs = Date.UTC(qatarYear, qatarMonth, qatarDate - dayOfWeek, 0, 0, 0, 0);
    const endQatarUtcMs = Date.UTC(qatarYear, qatarMonth, qatarDate + (6 - dayOfWeek), 23, 59, 59, 999);

    const startMs = startQatarUtcMs - QATAR_OFFSET_MS;
    const endMs = endQatarUtcMs - QATAR_OFFSET_MS;

    const startDate = new Date(startMs);
    const endDate = new Date(endMs);

    let labelAr = '';
    try {
      const fmt = new Intl.DateTimeFormat('ar-QA', {
        timeZone: 'Asia/Qatar',
        day: 'numeric',
        month: 'short'
      });
      labelAr = `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
    } catch {
      labelAr = `${startDate.toISOString().slice(0, 10)} – ${endDate.toISOString().slice(0, 10)}`;
    }

    return {
      timezone: 'Asia/Qatar',
      startMs,
      endMs,
      startIso: startDate.toISOString(),
      endIso: endDate.toISOString(),
      labelAr
    };
  }

  /**
   * Determines whether a class_name or grade label belongs to Grade 7, 8, or 9.
   * Returns '7' | '8' | '9' | null.
   */
  function parseGradeLevel(className, studentKey, studentName, gradeMap) {
    if (gradeMap && typeof gradeMap === 'object') {
      const byKey = studentKey && gradeMap[String(studentKey).trim()];
      const byName = studentName && gradeMap[String(studentName).trim()];
      const mapped = String(byKey || byName || '').trim();
      if (['7', '8', '9'].includes(mapped)) return mapped;
    }

    const raw = normalizeArabicText(className);
    if (!raw) return null;

    // Explicit Arabic words first
    const has7Word = /سابع/.test(raw);
    const has8Word = /ثامن/.test(raw);
    const has9Word = /تاسع/.test(raw);
    const wordMatches = [has7Word && '7', has8Word && '8', has9Word && '9'].filter(Boolean);
    if (wordMatches.length === 1) return wordMatches[0];
    if (wordMatches.length > 1) return null; // Ambiguous multi-grade string

    // Numeric patterns like "7/1", "7-2", "الصف 7", "صف 8", "grade 9", "g7"
    const numericMatches = new Set();
    const tokens = raw.match(/(?:^|[^\d])([789])(?=$|[^\d])/g) || [];
    for (const tk of tokens) {
      const digit = tk.replace(/\D/g, '');
      if (['7', '8', '9'].includes(digit)) numericMatches.add(digit);
    }
    // Check if there are other grade numbers like 6, 10, 11, 12 as primary prefix
    if (/(?:صف|الصف|grade)\s*(?:10|11|12|6|5|4)/.test(raw)) return null;

    const firstPrefix = raw.match(/^\s*([789])\s*[/\-\\]/);
    if (firstPrefix) return firstPrefix[1];

    if (numericMatches.size === 1) {
      return [...numericMatches][0];
    }

    return null;
  }

  const INVALID_STUDENT_NAMES = new Set([
    'طالب',
    'طالبه',
    'تجربه',
    'تجريبي',
    'معلم',
    'ادمن',
    'الاداره',
    'اختبار',
    'demo',
    'test',
    'student',
    'admin',
    'teacher',
    'user',
    'guest'
  ]);

  function isEligibleStudentName(rawName) {
    const cleaned = String(rawName ?? '').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 2) return false;
    const norm = normalizeArabicText(cleaned);
    if (!norm || INVALID_STUDENT_NAMES.has(norm)) return false;
    if (/^(test|demo|admin|طالب\s*\d*|تجرب)/.test(norm)) return false;
    if (/^\d+$/.test(norm)) return false;
    return true;
  }

  /**
   * Formats a student name according to school privacy settings.
   * Returns null if student is opted out or invalid.
   */
  function formatStudentChampionName(rawName, studentKey, settings) {
    const cfg = settings || {};
    const optOut = Array.isArray(cfg.studentOptOut) ? cfg.studentOptOut.map(x => normalizeArabicText(x)) : [];
    const normName = normalizeArabicText(rawName);
    const normKey = String(studentKey || '').trim().toLowerCase();

    if (optOut.includes(normName) || (normKey && optOut.includes(normKey))) {
      return null;
    }

    const displayMap = cfg.studentDisplayNames && typeof cfg.studentDisplayNames === 'object'
      ? cfg.studentDisplayNames
      : {};
    const explicitByKey = studentKey && displayMap[String(studentKey).trim()];
    const explicitByName = rawName && displayMap[String(rawName).trim()];
    const explicit = String(explicitByKey || explicitByName || '').trim();
    if (explicit) return explicit;

    if (!isEligibleStudentName(rawName)) return null;

    const privacyMode = cfg.studentPrivacyMode || 'abbreviated';
    if (privacyMode === 'approved_only') {
      return null;
    }

    const parts = String(rawName).replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (privacyMode === 'full' || parts.length === 1) {
      return parts.slice(0, 3).join(' ');
    }

    // Default 'abbreviated': First name + initial of second name (+ family name if 3+ parts)
    if (parts.length === 2) {
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return `${parts[0]} ${parts[1].charAt(0)}. ${parts[parts.length - 1]}`;
  }

  /**
   * Builds the list of eligible rotating hero slides from active games.
   */
  function getHeroSlides(options) {
    const opts = options || {};
    const settings = opts.settings || {};
    const puzzleAvailable = !!opts.puzzleAvailable || !!settings.enablePuzzleInHero;
    const defaultOrder = ['football', 'volleyball', 'basketball', 'race', 'bowling', 'fishing', 'classic', 'puzzle'];
    const configuredOrder = Array.isArray(settings.heroGames) && settings.heroGames.length
      ? settings.heroGames.filter(k => GAME_CATALOG[k])
      : defaultOrder;

    return configuredOrder
      .filter(k => k !== 'puzzle' || puzzleAvailable)
      .map(k => ({
        ...GAME_CATALOG[k],
        ctaLabel: k === 'puzzle' ? 'متاح داخل مهام الصور' : `جرّب ${GAME_CATALOG[k].name}`,
        ctaHref: k === 'puzzle' ? '#joinForm' : `index.html?demo=${k}`
      }));
  }

  /**
   * Extracts canonical YouTube 11-character ID from any YouTube URL or ID string.
   */
  function extractYouTubeId(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    if (/^[\w-]{11}$/.test(raw)) return raw;
    try {
      const u = new URL(raw);
      const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
      if (host === 'youtu.be') {
        const id = u.pathname.split('/').filter(Boolean)[0] || '';
        return /^[\w-]{11}$/.test(id) ? id : '';
      }
      if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const v = u.searchParams.get('v');
        if (v && /^[\w-]{11}$/.test(v)) return v;
        const m = u.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{11})/);
        if (m) return m[1];
      }
    } catch {
      const m = raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/);
      if (m) return m[1];
    }
    return '';
  }

  function normalizeVideoEntry(raw, sourceLabel) {
    if (!raw) return null;
    if (typeof raw === 'string') raw = { url: raw };
    if (raw.visible === false || raw.show_on_homepage === false || raw.published === false) return null;

    const rawUrl = String(raw.url || '').trim();
    const ytId = extractYouTubeId(rawUrl) || extractYouTubeId(raw.id);
    const isDirectVideo = /^https:\/\/.+\.(mp4|webm)(\?.*)?$/i.test(rawUrl);

    if (!ytId && !isDirectVideo) return null;

    const canonicalKey = ytId ? `yt:${ytId}` : `url:${rawUrl.toLowerCase()}`;
    const url = ytId ? `https://www.youtube.com/watch?v=${ytId}` : rawUrl;
    const embedUrl = ytId ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0` : rawUrl;
    const thumbnail = String(
      raw.thumbnail ||
      (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '')
    ).trim();

    return {
      key: canonicalKey,
      id: String(raw.id || ytId || canonicalKey),
      youtubeId: ytId || '',
      kind: ytId ? 'youtube' : 'direct',
      title: String(raw.title || 'فيديو تعليمي').trim() || 'فيديو تعليمي',
      subject: String(raw.subject || raw.category || sourceLabel || 'مكتبة المدرسة').trim(),
      description: String(raw.description || '').trim(),
      url,
      embedUrl,
      thumbnail,
      featured: !!raw.featured,
      createdAt: raw.created_at || raw.updated_at || null
    };
  }

  /**
   * Merges and deduplicates public homepage videos from:
   * 1. school_settings.data.homepageVideos (Admin school homepage settings)
   * 2. platform_state.data.platform.youtubeVideos (Admin platform YouTube manager)
   * 3. school_videos table (Public / homepage-enabled school videos)
   */
  function mergePublicVideos(options) {
    const opts = options || {};
    const showYoutube = opts.showYoutubeSection !== false;
    const featuredId = String(opts.featuredVideoId || '').trim();
    const map = new Map();

    const addCandidate = (item, sourceLabel) => {
      const norm = normalizeVideoEntry(item, sourceLabel);
      if (!norm) return;
      if (!map.has(norm.key)) {
        map.set(norm.key, norm);
      } else {
        const existing = map.get(norm.key);
        if ((!existing.title || /^فيديو\s*\d*$/.test(existing.title)) && norm.title && !/^فيديو\s*\d*$/.test(norm.title)) {
          existing.title = norm.title;
        }
        if ((!existing.subject || existing.subject === 'مكتبة المدرسة') && norm.subject) {
          existing.subject = norm.subject;
        }
        if (norm.featured) existing.featured = true;
      }
    };

    // 1. Admin homepageVideos in school_settings
    if (Array.isArray(opts.settingsVideos)) {
      for (const v of opts.settingsVideos) {
        addCandidate(v, 'إدارة المدرسة');
      }
    }

    // 2. Admin youtubeVideos in platform_state
    if (showYoutube && Array.isArray(opts.platformVideos)) {
      for (const v of opts.platformVideos) {
        addCandidate(v, 'القناة التعليمية');
      }
    }

    // 3. Public school_videos records
    if (Array.isArray(opts.schoolVideos)) {
      for (const v of opts.schoolVideos) {
        if (!v) continue;
        // Include if explicitly marked show_on_homepage === true, OR if not tied to a specific private game and not explicitly hidden
        const eligibleForHome = v.show_on_homepage === true || (v.show_on_homepage !== false && !v.game_id);
        if (!eligibleForHome) continue;
        addCandidate(v, v.subject || 'شروحات المواد');
      }
    }

    const list = [...map.values()];
    if (featuredId) {
      for (const v of list) {
        if (v.id === featuredId || v.youtubeId === featuredId || v.key === featuredId) {
          v.featured = true;
        }
      }
    }

    list.sort((a, b) => Number(b.featured) - Number(a.featured));
    return list.slice(0, 12);
  }

  /**
   * Computes weekly school rankings in Asia/Qatar time:
   * - Student Champions for Grades 7, 8, and 9
   * - Top 5 Most-Played Games
   * - Top 5 Most-Active Teachers
   */
  function computeWeeklyRankings(input) {
    const data = input || {};
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    const games = Array.isArray(data.games) ? data.games : [];
    const teachers = Array.isArray(data.teachers) ? data.teachers : [];
    const videos = Array.isArray(data.videos) ? data.videos : [];
    const settings = data.settings || {};

    const week = getQatarWeekBounds(data.now);

    const assignmentById = new Map();
    for (const a of assignments) {
      if (a && a.id) assignmentById.set(String(a.id), a);
    }

    const gameById = new Map();
    for (const g of games) {
      if (g && g.id) gameById.set(String(g.id), g);
    }

    const teacherById = new Map();
    for (const t of teachers) {
      if (t && t.id) teacherById.set(String(t.id), t);
    }

    // Filter sessions belonging to current Qatar week
    const weekSessions = sessions.filter(s => {
      if (!s || s.mode === 'demo') return false;
      const stamp = s.finished_at || s.created_at;
      if (!stamp) return false;
      const ms = new Date(stamp).getTime();
      return Number.isFinite(ms) && ms >= week.startMs && ms <= week.endMs;
    });

    // 1. Weekly Student Champions per Grade (7, 8, 9)
    // Only completed individual/home sessions with non-pending grading within the week
    const studentBuckets = { '7': new Map(), '8': new Map(), '9': new Map() };

    for (const s of weekSessions) {
      if (!s.finished_at || s.pending === true || s.mode === 'group' || s.mode === 'demo') continue;
      const finishedMs = new Date(s.finished_at).getTime();
      if (!Number.isFinite(finishedMs) || finishedMs < week.startMs || finishedMs > week.endMs) continue;

      const score = Number(s.score);
      if (!Number.isFinite(score) || score < 0 || score > 100) continue;

      const assignment = assignmentById.get(String(s.assignment_id || ''));
      const game = assignment ? gameById.get(String(assignment.game_id || '')) : null;
      const classLabel = assignment?.class_name || s.class_name || game?.grade || game?.data?.grade || '';

      const grade = parseGradeLevel(classLabel, s.student_key, s.student_name, settings.studentGradeMap);
      if (!grade || !studentBuckets[grade]) continue;

      const displayName = formatStudentChampionName(s.student_name, s.student_key, settings);
      if (!displayName) continue;

      const studentIdentity = String(s.student_key || normalizeArabicText(s.student_name)).trim();
      if (!studentIdentity) continue;

      const gradeMap = studentBuckets[grade];
      if (!gradeMap.has(studentIdentity)) {
        gradeMap.set(studentIdentity, {
          studentKey: studentIdentity,
          rawName: String(s.student_name || '').trim(),
          displayName,
          grade,
          className: String(assignment?.class_name || GRADE_META[grade].gradeLabel).trim(),
          attemptsByAssignment: new Map(),
          allScores: [],
          passedCount: 0,
          lastFinishedMs: finishedMs
        });
      }

      const rec = gradeMap.get(studentIdentity);
      rec.allScores.push(score);
      const passingThreshold = Number(assignment?.settings?.passing_score) || 70;
      if (score >= passingThreshold) rec.passedCount += 1;
      if (finishedMs > rec.lastFinishedMs) rec.lastFinishedMs = finishedMs;

      const aid = String(s.assignment_id || 'general');
      if (!rec.attemptsByAssignment.has(aid)) rec.attemptsByAssignment.set(aid, []);
      rec.attemptsByAssignment.get(aid).push(score);
    }

    const champions = ['7', '8', '9'].map(grade => {
      const meta = GRADE_META[grade];
      const candidates = [];

      for (const rec of studentBuckets[grade].values()) {
        // Anti-spam rule: count at most best 2 attempts per assignment toward points
        let cappedPoints = 0;
        let cappedAttempts = 0;
        for (const scores of rec.attemptsByAssignment.values()) {
          scores.sort((a, b) => b - a);
          const topTwo = scores.slice(0, 2);
          for (const sc of topTwo) {
            cappedPoints += sc;
            cappedAttempts += 1;
          }
        }

        const completedCount = rec.allScores.length;
        const avgScore = Math.round(rec.allScores.reduce((a, b) => a + b, 0) / completedCount);
        const bestScore = Math.max(...rec.allScores);
        const distinctAssignments = rec.attemptsByAssignment.size;

        // Require minimum meaningful accuracy (>= 50%) so random 0% clicks cannot win
        if (avgScore < 50) continue;

        const compositeScore = cappedPoints + (distinctAssignments * 25) + (rec.passedCount * 15);
        candidates.push({
          ...rec,
          completedCount,
          avgScore,
          bestScore,
          distinctAssignments,
          compositeScore,
           cappedAttempts
        });
      }

      candidates.sort((a, b) => {
        if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
        if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
        if (b.distinctAssignments !== a.distinctAssignments) return b.distinctAssignments - a.distinctAssignments;
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        return a.lastFinishedMs - b.lastFinishedMs;
      });

      const winner = candidates[0] || null;
      if (!winner) {
        return {
          ...meta,
          hasWinner: false,
          studentName: null,
          className: meta.gradeLabel,
          avgScore: null,
          bestScore: null,
          completedCount: 0,
          distinctAssignments: 0,
          compositeScore: 0,
          metricLabel: meta.emptySubtext
        };
      }

      const taskWord = winner.distinctAssignments === 1
        ? 'مهمة مكتملة'
        : winner.distinctAssignments === 2
          ? 'مهمتان مكتملتان'
          : `${winner.distinctAssignments} مهمات مكتملة`;

      return {
        ...meta,
        hasWinner: true,
        studentName: winner.displayName,
        className: winner.className || meta.gradeLabel,
        avgScore: winner.avgScore,
        bestScore: winner.bestScore,
        completedCount: winner.completedCount,
        distinctAssignments: winner.distinctAssignments,
        compositeScore: winner.compositeScore,
        metricLabel: `متوسط ${winner.avgScore}% · ${taskWord}`
      };
    });

    // 2. Weekly Most-Played Games (Top 5)
    const gameCounts = new Map();
    for (const s of weekSessions) {
      const tpl = String(s.template || '').trim();
      if (!GAME_CATALOG[tpl]) continue;
      // Count completed sessions or active classroom sessions
      if (s.mode !== 'group' && !s.finished_at) continue;
      if (!gameCounts.has(tpl)) {
        gameCounts.set(tpl, {
          key: tpl,
          name: GAME_CATALOG[tpl].name,
          badge: GAME_CATALOG[tpl].badge,
          cover: GAME_CATALOG[tpl].cover,
          sessionsCount: 0,
          students: new Set(),
          totalScore: 0,
          scoredCount: 0
        });
      }
      const g = gameCounts.get(tpl);
      g.sessionsCount += 1;
      if (s.student_key || s.student_name) {
        g.students.add(String(s.student_key || normalizeArabicText(s.student_name)));
      }
      if (Number.isFinite(Number(s.score)) && s.finished_at) {
        g.totalScore += Number(s.score);
        g.scoredCount += 1;
      }
    }

    const sortedGames = [...gameCounts.values()]
      .filter(g => g.sessionsCount > 0)
      .sort((a, b) => {
        if (b.sessionsCount !== a.sessionsCount) return b.sessionsCount - a.sessionsCount;
        return b.students.size - a.students.size;
      })
      .slice(0, 5);

    const maxGameSessions = sortedGames[0]?.sessionsCount || 1;
    const topGames = sortedGames.map((g, idx) => ({
      rank: idx + 1,
      key: g.key,
      name: g.name,
      badge: g.badge,
      cover: g.cover,
      sessionsCount: g.sessionsCount,
      uniqueStudents: g.students.size,
      avgScore: g.scoredCount ? Math.round(g.totalScore / g.scoredCount) : null,
      sharePercent: Math.max(12, Math.round((g.sessionsCount / maxGameSessions) * 100))
    }));

    // 3. Weekly Most-Active Teachers (Top 5)
    const teacherStats = new Map();
    const ensureTeacher = (tid, fallbackName) => {
      const id = String(tid || '').trim();
      if (!id) return null;
      const profile = teacherById.get(id);
      if (profile && profile.status === 'موقوف') return null;
      if (!teacherStats.has(id)) {
        const rawName = String(profile?.name || fallbackName || '').trim();
        teacherStats.set(id, {
          id,
          name: rawName || 'معلم بالمدرسة',
          subjects: new Set(),
          activeAssignments: new Set(),
          classroomSessions: 0,
          studentParticipations: 0,
          templatesUsed: new Set(),
          videosAdded: 0
        });
      } else if (fallbackName && teacherStats.get(id).name === 'معلم بالمدرسة') {
        teacherStats.get(id).name = String(fallbackName).trim();
      }
      return teacherStats.get(id);
    };

    for (const a of assignments) {
      if (!a || !a.teacher_id) continue;
      const createdMs = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdThisWeek = Number.isFinite(createdMs) && createdMs >= week.startMs && createdMs <= week.endMs;
      if (!createdThisWeek) continue;
      const g = gameById.get(String(a.game_id || ''));
      const t = ensureTeacher(a.teacher_id, g?.data?.teacher || g?.teacher);
      if (!t) continue;
      t.activeAssignments.add(String(a.id));
      const subj = g?.data?.subject || g?.subject;
      if (subj) t.subjects.add(String(subj).trim());
    }

    for (const s of weekSessions) {
      if (!s.teacher_id) continue;
      const a = assignmentById.get(String(s.assignment_id || ''));
      const g = a ? gameById.get(String(a.game_id || '')) : null;
      const t = ensureTeacher(s.teacher_id, g?.data?.teacher || g?.teacher);
      if (!t) continue;
      if (s.assignment_id) t.activeAssignments.add(String(s.assignment_id));
      if (s.template) t.templatesUsed.add(String(s.template));
      const subj = g?.data?.subject || g?.subject;
      if (subj) t.subjects.add(String(subj).trim());

      if (s.mode === 'group') {
        t.classroomSessions += 1;
      } else if (s.finished_at && s.pending !== true) {
        t.studentParticipations += 1;
        if (s.mode === 'individual') t.classroomSessions += 1;
      }
    }

    for (const v of videos) {
      if (!v || !v.teacher_id) continue;
      const createdMs = v.created_at ? new Date(v.created_at).getTime() : 0;
      if (Number.isFinite(createdMs) && createdMs >= week.startMs && createdMs <= week.endMs) {
        const t = ensureTeacher(v.teacher_id, '');
        if (t) {
          t.videosAdded += 1;
          if (v.subject) t.subjects.add(String(v.subject).trim());
        }
      }
    }

    const activeTeachers = [...teacherStats.values()]
      .map(t => {
        const assignmentsCount = t.activeAssignments.size;
        const engagementScore =
          (assignmentsCount * 30) +
          (t.classroomSessions * 20) +
          (t.studentParticipations * 10) +
          (t.templatesUsed.size * 15) +
          (t.videosAdded * 10);

        const parts = [];
        if (assignmentsCount > 0) {
          parts.push(assignmentsCount === 1 ? 'مهمة نشطة' : assignmentsCount === 2 ? 'مهمتان نشطتان' : `${assignmentsCount} مهمات نشطة`);
        }
        if (t.studentParticipations > 0) {
          parts.push(`${t.studentParticipations} مشاركة طلابية`);
        }
        if (t.classroomSessions > 0) {
          parts.push(`${t.classroomSessions} تفعيل صفي`);
        }

        return {
          id: t.id,
          name: t.name,
          subject: [...t.subjects].slice(0, 2).join(' · ') || 'مواد تعليمية',
          assignmentsCount,
          classroomSessions: t.classroomSessions,
          studentParticipations: t.studentParticipations,
          gamesVariety: t.templatesUsed.size,
          engagementScore,
          summaryText: parts.join(' · ') || 'تفعيل مستمر للمنصة'
        };
      })
      .filter(t => t.engagementScore > 0 && t.name && t.name !== 'معلم بالمدرسة')
      .sort((a, b) => {
        if (b.engagementScore !== a.engagementScore) return b.engagementScore - a.engagementScore;
        return b.studentParticipations - a.studentParticipations;
      })
      .slice(0, 5);

    return {
      week,
      champions,
      topGames,
      activeTeachers,
      totals: {
        weekSessionsCount: weekSessions.filter(s => s.finished_at || s.mode === 'group').length,
        verifiedChampionsCount: champions.filter(c => c.hasWinner).length
      }
    };
  }

  return {
    GAME_CATALOG,
    GRADE_META,
    getQatarWeekBounds,
    parseGradeLevel,
    isEligibleStudentName,
    formatStudentChampionName,
    getHeroSlides,
    extractYouTubeId,
    normalizeVideoEntry,
    mergePublicVideos,
    computeWeeklyRankings
  };
});
