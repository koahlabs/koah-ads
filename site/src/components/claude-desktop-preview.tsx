import { BasetenLogo } from "@/components/baseten-logo";
import { Icon } from "@/components/icon";
import { PreviewResponse, previewTiming } from "@/components/preview-response";
import { PreviewAdCredit, PreviewEarnings } from "@/components/preview-earnings";

const RESPONSE =
  "Baseten helps you deploy and run AI models. It handles the infrastructure so you can focus on your app.";

export function ClaudeDesktopPreview() {
  return (
    <div
      className="workspace workspace-desktop"
      style={previewTiming(RESPONSE)}
      role="img"
      aria-label="Claude Desktop task view with a sample Baseten sponsored ad under the answer, model controls, and a demo earnings balance that increases from $12.40 to $12.41 after the ad appears. The amounts are illustrative."
    >
      <div className="desktop-titlebar">
        <div className="desktop-window-controls" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="desktop-task-title">
          <span>Baseten summary</span>
        </div>
        <PreviewEarnings />
      </div>

      <div className="desktop-conversation">
        <p className="desktop-user-prompt preview-prompt">What does Baseten do?</p>
        <p className="desktop-answer preview-answer">
          <PreviewResponse text={RESPONSE} />
        </p>
        {/* The mod draws the ad under the last message of the answer, after a divider. */}
        <div className="desktop-sponsored-strip preview-ad">
          <hr className="sponsor-divider" />
          <div className="desktop-ad-heading">
            <div className="desktop-sponsor-name">
              <BasetenLogo />
              <span className="sponsor-brand">Baseten</span>
              <span className="sponsor-label">Sponsored</span>
            </div>
            <PreviewAdCredit />
          </div>
          <p>Production-ready AI inference. Fast models, less infrastructure.</p>
          <span className="desktop-ad-link">Learn more</span>
        </div>
      </div>

      <div className="desktop-composer">
        <div className="desktop-command-input">
          <span>Type / for commands</span>
          <span className="desktop-send" aria-hidden="true">
            <Icon name="arrow-up" size={13} />
          </span>
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
