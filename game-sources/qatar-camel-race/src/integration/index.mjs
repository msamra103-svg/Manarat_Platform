import { LocalSimulatorBridge } from "./localSimulatorBridge.mjs";
import { PostMessageBridge } from "./postMessageBridge.mjs";
function createBridge(config, { simSpec } = {}) {
  if (config.integration.bridge === "postMessage") {
    if (window.parent === window) {
      return new PostMessageBridge({ config, target: { postMessage() {
        throw new Error("no parent");
      } } });
    }
    return new PostMessageBridge({ config });
  }
  const source = window.QATAR_CAMEL_RACE_SAMPLE_QUESTIONS || null;
  return new LocalSimulatorBridge({ source, config, simSpec });
}
export {
  createBridge
};
