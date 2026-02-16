import React, { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Download, Copy, Check } from 'lucide-react';

interface PythonCodeDisplayProps {
  title: string;
  code: string;
  filename: string;
}

export function PythonCodeDisplay({ title, code, filename }: PythonCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="flex gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button onClick={handleDownload} variant="default" size="sm" className="gap-2">
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </div>
      <div className="bg-slate-950 text-slate-50 p-4 rounded-lg overflow-x-auto max-h-96 text-sm font-mono">
        <pre className="whitespace-pre">{code}</pre>
      </div>
    </Card>
  );
}
