import { BasetenLogo } from "@/components/baseten-logo";
import { Icon } from "@/components/icon";
import { PreviewResponse, previewTiming } from "@/components/preview-response";

const RESPONSE = "Baseten helps you deploy and run AI models. It handles the infrastructure so you can focus on your app.";

export function ClaudeDesktopPreview() {
  return (
    <div
      className="workspace workspace-desktop"
      style={previewTiming(RESPONSE)}
      role="img"
      aria-label="Claude Desktop task view with a Baseten summary, a sample sponsored ad above the command input, and the model controls below."
    >
      <div className="desktop-titlebar">
        <div className="desktop-window-controls" aria-hidden="true"><i /><i /><i /></div>
        <div className="desktop-task-title">
          <span>Baseten summary</span>
        </div>
        <div className="desktop-utilities">
          <Icon name="dots" size={14} />
        </div>
      </div>

      <div className="desktop-conversation">
        <p className="desktop-user-prompt preview-prompt">What does Baseten do?</p>
        <p className="desktop-answer preview-answer"><PreviewResponse text={RESPONSE} /></p>
      </div>

      <div className="desktop-composer">
        <div className="desktop-sponsored-strip preview-ad">
          <div className="desktop-ad-heading">
            <div className="desktop-sponsor-name">
              <BasetenLogo />
              <span className="sponsor-brand">Baseten</span>
              <span className="sponsor-label">Sponsored</span>
            </div>
          </div>
          <p>Production-ready AI inference. Fast models, less infrastructure.</p>
          <span className="desktop-ad-link">Learn more <Icon name="arrow-right" size={13} /></span>
        </div>
        <div className="desktop-command-input">
          <span>Type / for commands</span>
          <span className="desktop-send" aria-hidden="true"><Icon name="arrow-up" size={13} /></span>
        </div>
        <div className="desktop-composer-controls">
          <div className="desktop-input-tools">
            <Icon name="plus" size={15} />
            <span>Auto</span>
          </div>
          <div className="desktop-model-controls">
            <span>Opus 5.5</span>
            <Icon name="caret-down" size={11} />
          </div>
        </div>
      </div>
    </div>
  );
}
