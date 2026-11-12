"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { useUploads } from "@/components/UploadManager";

const TITLES: Record<string, string> = {
  newCaseScan: "New case scan",
  design: "Submit for review",
  tryInScans: "New scans after try-in",
  ibar: "Ibar done",
  matching: "Matching done",
  photogrammetry: "Photogrammetry done",
  work: "Work for review",
  upload: "Upload to the case",
};

// A file box whose files upload in the background when its form is
// submitted (see UploadManager): straight to the case's Drive folder, with a
// progress panel in the corner, so people can keep working. The form's step
// runs once the files are in Drive (on the New Case form, the case is
// created right away and the scan is attached when it finishes).
// `purpose` decides the folder and the step (see /api/drive-upload).
export function DirectFileField({
  name,
  purpose,
  caseId,
  caseName,
  required,
  multiple,
  hint,
}: {
  name: string;
  purpose: string;
  caseId?: string;
  caseName?: string;
  required?: boolean;
  multiple?: boolean;
  hint: string;
}) {
  const uploads = useUploads();
  const [label, setLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ready = useRef(false);

  useEffect(() => {
    const form = fileInput.current?.form;
    if (!form || !uploads) return;

    function onSubmit(event: SubmitEvent) {
      if (ready.current) {
        ready.current = false;
        return; // the New Case form, sent on after its scan was queued
      }
      const files = Array.from(fileInput.current?.files ?? []);
      if (files.length === 0) {
        if (purpose !== "newCaseScan" && uploads!.isBusy(caseId, purpose)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          setNotice("This is already uploading in the background (see the bottom-right corner).");
        }
        return; // no file: submit normally
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const submitter = event.submitter instanceof HTMLButtonElement ? event.submitter : undefined;
      const formData = new FormData(form!, submitter);
      const patient = String(formData.get("patientName") ?? "").trim() || caseName;

      uploads!.enqueue({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: `${TITLES[purpose] ?? "Upload"}${patient ? ` · ${patient}` : ""}`,
        step: purpose,
        caseId,
        fieldName: name,
        files,
        formData,
        linkBody: {
          subfolder: formData.get("subfolder") || undefined,
          doctorId: formData.get("doctorId"),
          newDoctorName: formData.get("newDoctorName"),
          patientName: formData.get("patientName"),
        },
      });
      if (fileInput.current) fileInput.current.value = "";
      setLabel(null);

      if (purpose === "newCaseScan") {
        // Create the case now; the scan is attached when its upload finishes.
        // (A form can't be re-sent while it's still handling this submit.)
        ready.current = true;
        setTimeout(() => form!.requestSubmit(submitter), 0);
      } else {
        setNotice(
          "Uploading in the background (see the bottom-right corner). This step finishes on its own when the upload is done; you can keep working."
        );
      }
    }

    const handler = (e: Event) => onSubmit(e as SubmitEvent);
    form.addEventListener("submit", handler, { capture: true });
    return () => form.removeEventListener("submit", handler, { capture: true });
  }, [uploads, purpose, caseId, caseName, name]);

  return (
    <>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
        {label ? (
          <>
            <FileCheck2 className="text-brand" size={24} />
            <span className="text-sm font-medium text-slate-900">{label}</span>
            <span className="text-xs text-slate-400">Click to choose a different file</span>
          </>
        ) : (
          <>
            <UploadCloud className="text-slate-400" size={24} />
            <span className="text-sm font-medium text-slate-600">Click to attach a file</span>
            <span className="text-xs text-slate-400">{hint}</span>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          required={required}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const files = e.target.files;
            setNotice(null);
            setLabel(!files || files.length === 0 ? null : files.length === 1 ? files[0].name : `${files.length} files`);
          }}
        />
      </label>
      {notice && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">{notice}</p>}
    </>
  );
}
