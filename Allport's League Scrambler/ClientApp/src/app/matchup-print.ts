export function renderMatchupPrint(window: Window, title: string, content: string, styles = ''): void {
    window.document.open();
    window.document.write(`<!doctype html>
<html lang="en">
<head>
    <title>${title}</title>
    <style>
        @page { size: portrait; margin: 1cm; }
        body { font-family: Arial, sans-serif; }
        app-matchup-print-sheet, app-matchup-print-six { display: block; }
        @media print {
            body { padding: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 5px; text-align: center; }
        }
        ${styles}
    </style>
</head>
<body>${content}</body>
</html>`);
    window.document.close();
}
