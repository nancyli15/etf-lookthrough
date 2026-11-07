"use client";
// A small "Download CSV" link at the bottom-right of a card, for the numbers in that
// card. The file is made in the browser from data the page already has, so nothing
// is sent anywhere.
type Props = {
  fileName: string; // Like "companies.csv".
  build: () => string; // Only runs when clicked, so big tables cost nothing until then.
  label?: string;
};

export default function DownloadCsv({ fileName, build, label = "Download CSV" }: Props) {
  function download() {
    // A Blob is a file in memory. A temporary link to it, clicked, saves it.
    const url = URL.createObjectURL(new Blob([build()], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="export-row">
      <button type="button" className="link small" onClick={download}>
        ↓ {label}
      </button>
    </div>
  );
}
