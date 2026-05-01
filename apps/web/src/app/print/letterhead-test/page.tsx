// /print/letterhead-test — print-test page for the YGE letterhead.
//
// Plain English: a single sheet of sample content rendered with the
// YGE letterhead so you can hit Cmd+P (Ctrl+P), confirm it looks right
// on real paper before pulling the trigger on a real bid envelope or
// AR invoice. Bare body — no AppShell — so it prints clean.

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export default function LetterheadTestPage() {
  return (
    <main className="bg-white px-12 py-10 text-sm leading-relaxed text-gray-900">
      {/* HEADER LETTERHEAD */}
      <header className="mb-10 flex items-start justify-between border-b-2 border-blue-700 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-blue-700 text-base font-bold text-white">
            YGE
          </div>
          <div>
            <div className="text-lg font-bold text-blue-700">Young General Engineering, Inc</div>
            <div className="text-xs text-gray-700">19645 Little Woods Rd, Cottonwood CA 96022</div>
            <div className="text-xs text-gray-700">CSLB License 1145219 · DIR Number 2000018967 · DOT 4528204</div>
          </div>
        </div>
        <div className="text-right text-xs text-gray-600">
          <div className="font-semibold text-gray-900">President</div>
          <div>Brook L Young</div>
          <div>brookyoung@youngge.com</div>
          <div>707-499-7065</div>
          <div className="mt-2 font-semibold text-gray-900">Vice President</div>
          <div>Ryan D Young</div>
          <div>ryoung@youngge.com</div>
          <div>707-599-9921</div>
        </div>
      </header>

      {/* BODY — sample letter */}
      <section>
        <div className="mb-6 text-xs text-gray-600">{TODAY}</div>

        <div className="mb-6">
          [Recipient name]
          <br />
          [Recipient address]
        </div>

        <div className="mb-6">
          <strong>RE:</strong> Letterhead test — verify this prints correctly
        </div>

        <p className="mb-4">
          This is a test page. Open the print dialog (Cmd+P on macOS, Ctrl+P on Windows) and look at the preview.
          What you should see:
        </p>
        <ul className="mb-4 list-disc pl-5">
          <li>YGE logo + company info in the header band, with a thin blue rule underneath</li>
          <li>President + VP contact info aligned right in the header</li>
          <li>Today&apos;s date below the header band</li>
          <li>This sample body text in clean black on white</li>
          <li>A footer at the bottom with the legal company line</li>
        </ul>
        <p className="mb-4">
          If anything looks off — logo cut off, header cramped, footer missing on letter-sized paper — note it and we&apos;ll
          tune the print CSS. Once this looks right, the same letterhead is used by the bid transmittal,
          envelope checklist, AR invoice, lien waiver, and certified payroll print views.
        </p>
        <p className="mb-4">Sincerely,</p>
        <p className="mb-1">[Signature]</p>
        <p className="text-xs text-gray-700">Ryan D Young, Vice President</p>
        <p className="text-xs text-gray-700">Young General Engineering, Inc</p>
      </section>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-gray-300 pt-3 text-center text-[10px] text-gray-500">
        Young General Engineering, Inc · 19645 Little Woods Rd, Cottonwood CA 96022 · CSLB 1145219 · DIR 2000018967
      </footer>
    </main>
  );
}
