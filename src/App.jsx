import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  BadgeCheck,
  Braces,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileJson,
  Flag,
  Image,
  Keyboard,
  PanelLeftOpen,
  RotateCcw,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Upload,
} from 'lucide-react';
import { SAMPLE_ITEMS } from './sampleItems';
import './styles.css';

const STORAGE_KEY = 'ocr-labeling-console:v2-camel-images';

function normalizeItem(raw, index) {
  return {
    id: raw.id || raw.line_id || raw.page_id || `item-${index + 1}`,
    examId: raw.examId || raw.exam_id || 'unknown-exam',
    studentName: raw.studentName || raw.student_name || raw.display_name || 'Unknown',
    grade: raw.grade || raw.grade_level || '',
    pageNum: raw.pageNum ?? raw.page_num ?? '',
    lineNum: raw.lineNum ?? raw.line_num ?? '',
    taskType: raw.taskType || raw.task_type || '',
    imageUrl: raw.imageUrl || raw.image_url || raw.image_path || '',
    pageImageUrl: raw.pageImageUrl || raw.page_image_url || raw.page_image_path || '',
    pageLineUrls: raw.pageLineUrls || raw.page_line_urls || [],
    appleText: raw.appleText || raw.apple_ocr || raw.baseline_ocr || raw.original_text || '',
    qwenText: raw.qwenText || raw.qwen_ocr || raw.qwen_vlm || raw.prediction || '',
    loraText: raw.loraText || raw.qwen_lora_ocr || raw.lora_prediction || '',
    currentText: raw.currentText || raw.corrected_text || raw.chosen_text || raw.transcript || raw.prediction || raw.original_text || '',
    confidence: Number(raw.confidence ?? raw.ocr_confidence ?? 0),
    reviewRequired: Boolean(raw.reviewRequired ?? raw.review_required ?? false),
    reasons: Array.isArray(raw.reasons) ? raw.reasons : raw.review_reasons || [],
    teacherScore: raw.teacherScore || {
      structure: raw.teacher_structure ?? '',
      content: raw.teacher_content ?? '',
      mechanics: raw.teacher_mechanics ?? '',
    },
  };
}

function parseJsonOrJsonl(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed).map(normalizeItem);
  }
  return trimmed
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => normalizeItem(JSON.parse(line), index));
}

function toJsonl(rows) {
  return rows.map((row) => JSON.stringify(row, null, 0)).join('\n') + '\n';
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/jsonl;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function confidenceClass(value) {
  if (value >= 0.85) return 'good';
  if (value >= 0.65) return 'warn';
  return 'bad';
}

function normalizePath(path) {
  return String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function basename(path) {
  return normalizePath(path).split('/').pop();
}

function isBrowserUrl(path) {
  return /^(https?:|blob:|data:)/i.test(String(path || ''));
}

function resolveImageSource(item, mode, imageMap) {
  const requested = mode === 'page' ? item.pageImageUrl || item.imageUrl : item.imageUrl || item.pageImageUrl;
  if (!requested) return '';
  if (isBrowserUrl(requested)) return requested;
  const normalized = normalizePath(requested);
  return imageMap[normalized] || imageMap[basename(normalized)] || `${import.meta.env.BASE_URL}sample-data/${normalized}`;
}

function resolveLineSources(item, imageMap) {
  return (item.pageLineUrls || []).map((path) => {
    if (isBrowserUrl(path)) return path;
    const normalized = normalizePath(path);
    return imageMap[normalized] || imageMap[basename(normalized)] || `${import.meta.env.BASE_URL}sample-data/${normalized}`;
  });
}

function App() {
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasImages = parsed.some((item) => item.imageUrl || item.image_url || item.pageLineUrls?.length || item.page_line_urls?.length);
        return hasImages ? parsed : SAMPLE_ITEMS;
      } catch {
        return SAMPLE_ITEMS;
      }
    }
    return SAMPLE_ITEMS;
  });
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [imageMap, setImageMap] = useState({});
  const [imageMode, setImageMode] = useState('page');
  const [zoom, setZoom] = useState(1);
  const [contrast, setContrast] = useState(1.08);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'open') return items.filter((item) => item.status !== 'verified');
    if (filter === 'review') return items.filter((item) => item.reviewRequired || item.confidence < 0.8);
    if (filter === 'done') return items.filter((item) => item.status === 'verified');
    return items;
  }, [items, filter]);

  const current = filtered[index] || filtered[0] || null;
  const currentGlobalIndex = current ? items.findIndex((item) => item.id === current.id) : -1;
  const currentImageSrc = current ? resolveImageSource(current, imageMode, imageMap) : '';
  const currentLineSources = current && imageMode === 'page' ? resolveLineSources(current, imageMap) : [];

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((item) => item.status === 'verified').length;
    const review = items.filter((item) => item.reviewRequired || item.confidence < 0.8).length;
    const avgConfidence = total ? items.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / total : 0;
    return { total, done, review, avgConfidence };
  }, [items]);

  function patchCurrent(patch) {
    if (currentGlobalIndex < 0) return;
    setItems((prev) => prev.map((item, i) => (i === currentGlobalIndex ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item)));
  }

  function patchTeacherScore(axis, value) {
    if (!current) return;
    patchCurrent({ teacherScore: { ...current.teacherScore, [axis]: value } });
  }

  function saveAndNext(status = 'verified') {
    patchCurrent({ status, reviewedAt: new Date().toISOString() });
    setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    setToast(status === 'uncertain' ? 'Uncertain으로 표시했습니다.' : '저장했습니다.');
    setTimeout(() => setToast(''), 1400);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) return;
      const key = event.key.toLowerCase();
      if (key === 'a' && current) patchCurrent({ currentText: current.appleText });
      if (key === 'q' && current) patchCurrent({ currentText: current.qwenText });
      if (key === 'l' && current) patchCurrent({ currentText: current.loraText });
      if (key === 's') saveAndNext('verified');
      if (key === 'u') saveAndNext('uncertain');
      if (key === 'arrowright' || key === 'n') setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      if (key === 'arrowleft' || key === 'p') setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // The handler intentionally uses the latest visible item context while avoiding textarea/input capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, filtered.length, currentGlobalIndex]);

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseJsonOrJsonl(text);
    setItems(parsed);
    setIndex(0);
    setToast(`${parsed.length}개 item을 불러왔습니다.`);
    setTimeout(() => setToast(''), 1600);
  }

  function handleImageImport(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    const nextMap = {};
    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const relativePath = normalizePath(file.webkitRelativePath || file.name);
      nextMap[relativePath] = objectUrl;
      nextMap[file.name] = objectUrl;
      nextMap[basename(relativePath)] = objectUrl;
    }
    setImageMap((prev) => ({ ...prev, ...nextMap }));
    setToast(`${files.length}개 시험지/라인 이미지를 연결했습니다.`);
    setTimeout(() => setToast(''), 1800);
  }

  function loadCamelDemo() {
    localStorage.removeItem(STORAGE_KEY);
    setItems(SAMPLE_ITEMS);
    setIndex(0);
    setFilter('all');
    setImageMode('page');
    setToast('camel 샘플 이미지 queue를 다시 불러왔습니다.');
    setTimeout(() => setToast(''), 1800);
  }

  function exportLabels() {
    const rows = items.map((item) => ({
      id: item.id,
      exam_id: item.examId,
      student_name: item.studentName,
      grade: item.grade,
      page_num: item.pageNum,
      line_num: item.lineNum,
      task_type: item.taskType,
      corrected_text: item.currentText,
      status: item.status || 'open',
      confidence: item.confidence,
      review_required: item.reviewRequired,
      teacher_structure: item.teacherScore?.structure ?? '',
      teacher_content: item.teacherScore?.content ?? '',
      teacher_mechanics: item.teacherScore?.mechanics ?? '',
      reviewer_notes: item.notes || '',
      updated_at: item.updatedAt || null,
      reviewed_at: item.reviewedAt || null,
    }));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`labels-export-${stamp}.jsonl`, toJsonl(rows));
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow"><Sparkles size={15} /> Private labeling cockpit</p>
          <h1>OCR Labeling Console</h1>
          <p className="subtitle">학생 원문 보존 OCR 검수 + teacher-aligned SCM 라벨링을 위한 GitHub Pages prototype.</p>
        </div>
        <div className="heroActions">
          <label className="button secondary">
            <Upload size={17} /> Import JSONL
            <input type="file" accept=".json,.jsonl,.txt" onChange={handleImport} hidden />
          </label>
          <label className="button secondary">
            <Image size={17} /> Import images folder
            <input type="file" accept="image/*" multiple webkitdirectory="" onChange={handleImageImport} hidden />
          </label>
          <button className="button secondary" onClick={loadCamelDemo}>Load camel demo</button>
          <button className="button primary" onClick={exportLabels}><Download size={17} /> Export labels</button>
        </div>
      </header>

      <section className="statsGrid">
        <div className="stat"><span>Total</span><strong>{stats.total}</strong></div>
        <div className="stat"><span>Verified</span><strong>{stats.done}</strong></div>
        <div className="stat"><span>Needs review</span><strong>{stats.review}</strong></div>
        <div className="stat"><span>Avg confidence</span><strong>{Math.round(stats.avgConfidence * 100)}%</strong></div>
      </section>

      <section className="workspace">
        <aside className="queue">
          <div className="panelTitle"><PanelLeftOpen size={16} /> Work queue</div>
          <div className="filters">
            {['all', 'open', 'review', 'done'].map((name) => (
              <button key={name} className={filter === name ? 'active' : ''} onClick={() => { setFilter(name); setIndex(0); }}>{name}</button>
            ))}
          </div>
          <div className="queueList">
            {filtered.map((item, i) => (
              <button key={item.id} className={`queueItem ${current?.id === item.id ? 'selected' : ''}`} onClick={() => setIndex(i)}>
                <span className={`dot ${item.status === 'verified' ? 'done' : confidenceClass(item.confidence)}`} />
                <span>
                  <b>{item.studentName}</b>
                  <small>{item.examId} · p{item.pageNum}{item.lineNum ? ` l${item.lineNum}` : ''}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {current ? (
          <section className="reviewCard">
            <div className="cardHeader">
              <div>
                <p className="eyebrow"><FileJson size={14} /> {current.examId}</p>
                <h2>{current.studentName} <span>{current.grade}</span></h2>
                <p className="meta">Page {current.pageNum}{current.lineNum ? ` · Line ${current.lineNum}` : ''} · Task {current.taskType || 'n/a'}</p>
              </div>
              <div className={`confidence ${confidenceClass(current.confidence)}`}>{Math.round(current.confidence * 100)}%</div>
            </div>

            <div className="reviewBody">
              <section className="imagePane">
                <div className="imageToolbar">
                  <div className="segmented">
                    <button className={imageMode === 'page' ? 'active' : ''} onClick={() => setImageMode('page')}>Page</button>
                    <button className={imageMode === 'line' ? 'active' : ''} onClick={() => setImageMode('line')}>Line crop</button>
                  </div>
                  <div className="imageControls">
                    <button onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}><ZoomOut size={15} /></button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom((value) => Math.min(2.6, value + 0.15))}><ZoomIn size={15} /></button>
                    <button onClick={() => { setZoom(1); setContrast(1.08); }}><RotateCcw size={15} /></button>
                    <label>Contrast <input type="range" min="0.8" max="1.8" step="0.05" value={contrast} onChange={(event) => setContrast(Number(event.target.value))} /></label>
                  </div>
                </div>
                <div className="imageStage">
                  {imageMode === 'page' && currentLineSources.length ? (
                    <div className="syntheticPage" style={{ transform: `scale(${zoom})`, filter: `contrast(${contrast})` }}>
                      <div className="syntheticHeader">{current.studentName} · page {current.pageNum} · reconstructed from line crops</div>
                      {currentLineSources.map((src, lineIndex) => <img key={`${src}-${lineIndex}`} src={src} alt={`line ${lineIndex + 1}`} />)}
                    </div>
                  ) : currentImageSrc ? (
                    <img src={currentImageSrc} alt={imageMode === 'page' ? 'Exam page' : 'OCR crop'} style={{ transform: `scale(${zoom})`, filter: `contrast(${contrast})` }} />
                  ) : (
                    <div className="imagePlaceholder">
                      시험지 이미지가 아직 연결되지 않았습니다.<br />
                      JSONL에는 <code>{imageMode === 'page' ? 'page_image_url/page_line_urls' : 'image_url'}</code> 또는 image_path를 넣고,<br />
                      위의 <b>Import images folder</b>로 같은 파일명을 가진 이미지 폴더를 올리세요.
                    </div>
                  )}
                </div>
              </section>

              <section className="editPane">
                <div className="ocrGrid">
                  <button onClick={() => patchCurrent({ currentText: current.appleText })}><b>A</b><span>Apple / baseline</span><p>{current.appleText || '—'}</p></button>
                  <button onClick={() => patchCurrent({ currentText: current.qwenText })}><b>Q</b><span>Qwen VLM</span><p>{current.qwenText || '—'}</p></button>
                  <button onClick={() => patchCurrent({ currentText: current.loraText })}><b>L</b><span>Qwen LoRA</span><p>{current.loraText || '—'}</p></button>
                </div>

                <label className="fieldLabel">Corrected text</label>
                <textarea
                  className="corrected"
                  value={current.currentText}
                  onChange={(event) => patchCurrent({ currentText: event.target.value })}
                  spellCheck={false}
                />

                <div className="scoringPanel">
                  <div>
                    <div className="panelTitle"><BadgeCheck size={16} /> Teacher SCM</div>
                    <p>선택 입력. OCR 라벨만 export 가능.</p>
                  </div>
                  {['structure', 'content', 'mechanics'].map((axis) => (
                    <label key={axis}>
                      {axis[0].toUpperCase() + axis.slice(1)}
                      <input value={current.teacherScore?.[axis] ?? ''} onChange={(event) => patchTeacherScore(axis, event.target.value)} placeholder="0-8" />
                    </label>
                  ))}
                </div>

                <div className="reasonRow">
                  <ShieldAlert size={16} />
                  {(current.reasons || []).length ? current.reasons.map((reason) => <span key={reason}>{reason}</span>) : <span>no review reason</span>}
                </div>

                <div className="footerActions">
                  <button className="button ghost" onClick={() => setIndex((i) => Math.max(i - 1, 0))}><ChevronLeft size={17} /> Prev</button>
                  <button className="button warning" onClick={() => saveAndNext('uncertain')}><Flag size={17} /> Uncertain</button>
                  <button className="button primary" onClick={() => saveAndNext('verified')}><Check size={17} /> Save & Next</button>
                  <button className="button ghost" onClick={() => setIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)))}>Next <ChevronRight size={17} /></button>
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section className="emptyState"><Braces size={34} /> Import JSONL to start labeling.</section>
        )}

        <aside className="guide">
          <div className="panelTitle"><Keyboard size={16} /> Shortcuts</div>
          <dl>
            <dt>A/Q/L</dt><dd>OCR 후보 선택</dd>
            <dt>S</dt><dd>저장 후 다음</dd>
            <dt>U</dt><dd>uncertain 표시</dd>
            <dt>N/P</dt><dd>다음/이전</dd>
          </dl>
          <div className="privacyBox">
            <ArrowDownToLine size={17} />
            <b>Privacy rule</b>
            <p>이 repo에는 UI 코드만 둡니다. 실제 학생 이미지/점수/라벨은 private storage 또는 Supabase로 분리하세요.</p>
          </div>
        </aside>
      </section>

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

export default App;
