import { BasetenLogo } from "@/components/baseten-logo";
import { Icon } from "@/components/icon";
import { PreviewResponse, previewTiming } from "@/components/preview-response";
import { PreviewAdCredit, PreviewEarnings } from "@/components/preview-earnings";

const RESPONSE = "I can help with that. Are you calling an API or running a model locally?";

function ClaudeCodeMascot() {
  // Match the block mascot in the user's Claude Code startup screenshot.
  return (
    <svg className="code-mascot" width="48" height="32" viewBox="0 0 78 50" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path d="M9 0H69V20H78V30H69V50H65V40H59V50H55V40H23V50H19V40H13V50H9V30H0V20H9Z" fill="#d77757" />
      <path d="M19 10H23V20H19ZM55 10H59V20H55Z" fill="#121416" />
    </svg>
  );
}

export function ClaudeCodePreview() {
  return (
    <div
      className="workspace workspace-code"
      style={previewTiming(RESPONSE)}
      role="img"
      aria-label="Claude Code terminal preview with a sample Baseten sponsored ad, a command prompt, and a demo earnings balance that increases from $12.40 to $12.41 after the ad appears. The amounts are illustrative."
    >
      <div className="code-titlebar">
        <div className="code-window-controls" aria-hidden="true"><i /><i /><i /></div>
        <span className="code-window-title"><Icon name="folder" size={12} /><span>Inference</span></span>
        <PreviewEarnings />
      </div>

      <div className="code-content">
        <div className="code-startup">
          <ClaudeCodeMascot />
          <div className="code-startup-details">
            <p><strong>Claude Code</strong> <span>v2.1.293</span></p>
            <p>Opus 5.5 (1M context) · Claude Max</p>
            <p className="code-directory">~/projects/next-big-thing</p>
          </div>
        </div>
        <p className="code-user-prompt preview-prompt"><Icon name="chevron" size={13} />I need help with inference.</p>
        <div className="code-answer">
          <span className="code-answer-dot preview-answer-marker" aria-hidden="true" />
          <p className="preview-answer"><PreviewResponse text={RESPONSE} /></p>
        </div>
        <p className="code-complete preview-complete">Baked for 4s</p>
      </div>

      <div className="code-bottom">
        <div className="sponsored-strip preview-ad">
          <div className="sponsor-heading">
            <div className="sponsor-name">
              <BasetenLogo />
              <span className="sponsor-brand">Baseten</span>
              <span className="sponsor-label">Sponsored</span>
            </div>
            <PreviewAdCredit />
          </div>
          <p>Production-ready AI inference. Fast models, less infrastructure.</p>
          <span className="sponsor-cta">Learn more <Icon name="arrow-right" size={14} /></span>
        </div>
        <div className="code-command-input">
          <Icon name="chevron" size={14} />
          <span className="code-cursor" aria-hidden="true" />
        </div>
        <div className="code-mode-bar">
          <span className="code-auto-mode"><Icon name="fast-forward" size={13} />auto mode on</span>
          <span className="code-mode-hint">(shift+tab to cycle)</span>
          <span className="code-agent-count">· <Icon name="arrow-left" size={11} />1 agent</span>
        </div>
      </div>
    </div>
  );
}
