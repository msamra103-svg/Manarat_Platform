import { LocalSimulatorBridge } from './localSimulatorBridge.js';
import { PostMessageBridge } from './postMessageBridge.js';

// طبقة الربط: محرك السباق لا يعرف إلا هذه الواجهة.
// local = محاكي محلي منفصل للتجربة المستقلة، postMessage = المنصة (عقد مقترح).
// لا يوجد أي انتقال تلقائي من المنصة إلى المحاكي عند تعطل الربط.
export function createBridge(config, { simSpec } = {}) {
  if (config.integration.bridge === 'postMessage') {
    if (window.parent === window) {
      // ليست داخل منصة: نرفض بدل الانتقال الصامت للتصحيح التجريبي
      return new PostMessageBridge({ config, target: { postMessage() { throw new Error('no parent'); } } });
    }
    return new PostMessageBridge({ config });
  }
  const source = window.HORSE_JUMPING_RACE_SAMPLE_QUESTIONS || null;
  return new LocalSimulatorBridge({ source, config, simSpec });
}
