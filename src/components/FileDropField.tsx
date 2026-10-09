"use client";

import { useState } from "react";
import { UploadCloud, FileCheck2 } from "lucide-react";

export function FileDropField({
  name,
  required,
  hint,
  multiple,
}: {
  name: string;
  required?: boolean;
  hint: string;
  multiple?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-brand/40 hover:bg-brand-soft/40">
      {fileName ? (
        <>
          <FileCheck2 className="text-brand" size={24} />
          <span className="text-sm font-medium text-slate-900">{fileName}</span>
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
        type="file"
        name={name}
        required={required}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          setFileName(
            !files || files.length === 0 ? null : files.length === 1 ? files[0].name : `${files.length} files`
          );
        }}
      />
    </label>
  );
}
