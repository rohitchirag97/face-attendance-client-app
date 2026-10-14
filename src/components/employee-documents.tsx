import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, Field, Spinner } from "@/components/form-kit";
import { inputClass } from "@/lib/form-utils";
import {
  employeeDocumentsQuery,
  fetchDocumentUrl,
  useDeleteEmployeeDocument,
  useUploadEmployeeDocument,
} from "@/hooks/use-employee-records";

const MAX_BYTES = 5 * 1024 * 1024;

const TYPE_LABELS: Record<string, string> = {
  id_proof: "ID proof",
  address_proof: "Address proof",
  contract: "Contract",
  offer_letter: "Offer letter",
  certificate: "Certificate",
  other: "Other",
};
const EMPLOYEE_TYPES = ["id_proof", "address_proof", "certificate", "other"];

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const EmployeeDocuments: React.FC<{
  organizationId: string;
  employeeId: string;
  isManager: boolean;
  currentUserId: string;
}> = ({ organizationId, employeeId, isManager, currentUserId }) => {
  const { data, isLoading, error: loadError } = useQuery(
    employeeDocumentsQuery(organizationId, employeeId),
  );
  const upload = useUploadEmployeeDocument(organizationId, employeeId);
  const remove = useDeleteEmployeeDocument(organizationId, employeeId);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("id_proof");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const types = isManager ? Object.keys(TYPE_LABELS) : EMPLOYEE_TYPES;

  const handleUpload = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!file) return setError("Choose a file to upload.");
    if (file.size > MAX_BYTES) return setError("The file must be 5 MB or smaller.");
    upload.mutate(
      { file, docType, name },
      {
        onSuccess: () => {
          setFile(null);
          setName("");
          if (fileInput.current) fileInput.current.value = "";
        },
        onError: (e) => setError(e.message),
      },
    );
  };

  const open = async (documentId: string) => {
    setError(null);
    setOpening(documentId);
    try {
      const { url } = await fetchDocumentUrl(organizationId, employeeId, documentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open the document.");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleUpload}
        className="grid gap-3 rounded-xl border bg-background p-5 shadow-sm sm:grid-cols-2"
        noValidate
      >
        <Field label="Document type">
          {(id) => (
            <select id={id} value={docType} onChange={(e) => setDocType(e.target.value)} className={inputClass}>
              {types.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Label (optional)">
          {(id) => (
            <input id={id} value={name} maxLength={150} onChange={(e) => setName(e.target.value)} placeholder="Aadhaar card" className={inputClass} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="File" hint="PDF, JPG or PNG, up to 5 MB.">
            {(id) => (
              <input
                id={id}
                ref={fileInput}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm"
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" className="h-10" disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload
          </Button>
        </div>
      </form>
      <ErrorText message={error ?? loadError?.message} />

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState text="No documents uploaded yet." />
      ) : (
        <ul className="divide-y rounded-xl border">
          {data.map((document) => {
            const canDelete = isManager || document.uploadedBy === currentUserId;
            return (
              <li key={document.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[document.docType] ?? document.docType} · {formatSize(document.sizeBytes)} ·{" "}
                    {new Date(document.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`Open ${document.name}`}
                  disabled={opening === document.id}
                  onClick={() => void open(document.id)}
                >
                  {opening === document.id ? <Loader2 className="animate-spin" /> : <Download />}
                </Button>
                {canDelete && (
                  <Button
                    variant="destructive"
                    size="icon"
                    aria-label={`Delete ${document.name}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      setError(null);
                      remove.mutate(document.id, { onError: (e) => setError(e.message) });
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default EmployeeDocuments;
