/**
 * Single asset upload control (`frontend`).
 *
 * A labelled file picker for one asset role. On file selection it calls the
 * supplied `onUpload(role, file)` handler (which wraps `client.uploadAsset`),
 * showing per-control busy / success / error state. The parent owns the actual
 * upload + readiness refresh so this stays a focused, reusable control
 * (Req 2.1–2.7).
 */
import { useId, useState } from "react";
import type { ChangeEvent, JSX } from "react";
import { ApiClientError } from "../api/index.js";
import type { AssetRole } from "../pages/assetRoles.js";

export interface AssetUploadControlProps {
  /** The role this control uploads for. */
  role: AssetRole;
  /** Whether this role is currently present in the project. */
  present: boolean;
  /** Upload handler; resolves when the upload + readiness refresh complete. */
  onUpload: (role: string, file: File) => Promise<void>;
}

type ControlState =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "done" }
  | { kind: "error"; message: string };

export function AssetUploadControl({
  role,
  present,
  onUpload,
}: AssetUploadControlProps): JSX.Element {
  const inputId = useId();
  const [state, setState] = useState<ControlState>({ kind: "idle" });

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    setState({ kind: "uploading" });
    try {
      await onUpload(role.role, file);
      setState({ kind: "done" });
    } catch (err) {
      setState({ kind: "error", message: toMessage(err) });
    } finally {
      // Allow re-selecting the same file to re-upload (replace, Req 2.7).
      event.target.value = "";
    }
  }

  return (
    <div className="asset-control" data-role={role.role} data-present={present}>
      <label htmlFor={inputId}>
        {role.label}
        {role.required && <span aria-hidden="true"> *</span>}
        <span className={present ? "badge present" : "badge missing"}>
          {present ? "present" : "missing"}
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        accept={role.accept}
        aria-label={`Upload ${role.label}`}
        disabled={state.kind === "uploading"}
        onChange={handleChange}
      />
      {state.kind === "uploading" && <span className="status">Uploading…</span>}
      {state.kind === "done" && (
        <span className="status success" role="status">
          Uploaded
        </span>
      )}
      {state.kind === "error" && (
        <span className="status error" role="alert">
          {state.message}
        </span>
      )}
    </div>
  );
}

/** Turn a thrown value into a user-facing message, preferring API messages. */
function toMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Upload failed. Please try again.";
}
