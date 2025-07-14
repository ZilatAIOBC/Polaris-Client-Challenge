
'use client';

import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadCloud, File as FileIcon, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { cn, formatFileSize } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from './ui/separator';

const MAX_CONCURRENT_UPLOADS = 3;
const MAX_RETRIES = 3;

type UploadStatus = 'queued' | 'uploading' | 'success' | 'error';

type UploadableFile = {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  retryCount: number;
};

const fakeUpload = (onProgress: (progress: number) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const uploadTime = Math.random() * 4000 + 1000;
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      if (progress <= 100) {
        onProgress(progress);
      }
      if (progress >= 100) {
        clearInterval(interval);
        if (Math.random() > 0.2) {
          resolve();
        } else {
          reject(new Error('Upload failed'));
        }
      }
    }, uploadTime / 10);
  });
};

export function FileUploader() {
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processQueue = useCallback(() => {
    const uploadingCount = files.filter(f => f.status === 'uploading').length;
    const queuedFiles = files.filter(f => f.status === 'queued');

    const availableSlots = MAX_CONCURRENT_UPLOADS - uploadingCount;

    if (queuedFiles.length > 0 && availableSlots > 0) {
      const filesToStart = queuedFiles.slice(0, availableSlots);
      
      const startUpload = async (fileToStart: UploadableFile) => {
        setFiles(currentFiles => 
          currentFiles.map(f => f.id === fileToStart.id ? { ...f, status: 'uploading', progress: 0 } : f)
        );

        try {
          await fakeUpload((progress) => {
            setFiles(currentFiles => 
              currentFiles.map(f => f.id === fileToStart.id ? { ...f, progress } : f)
            );
          });
          setFiles(currentFiles => 
            currentFiles.map(f => f.id === fileToStart.id ? { ...f, status: 'success', progress: 100 } : f)
          );
        } catch (error) {
          setFiles(currentFiles => 
            currentFiles.map(f => {
              if (f.id === fileToStart.id) {
                const newRetryCount = f.retryCount + 1;
                return newRetryCount < MAX_RETRIES 
                  ? { ...f, status: 'queued', retryCount: newRetryCount } 
                  : { ...f, status: 'error' };
              }
              return f;
            })
          );
        }
      };

      filesToStart.forEach(startUpload);
    }
  }, [files]);

  useEffect(() => {
    processQueue();
  }, [files, processQueue]);
  
  const handleAddFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const uploadableFiles: UploadableFile[] = Array.from(newFiles).map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      progress: 0,
      retryCount: 0,
    }));
    setFiles(prev => [...prev, ...uploadableFiles]);
  };
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleAddFiles(e.dataTransfer.files);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleAddFiles(e.target.files);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };
  
  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success' && f.status !== 'error'));
  };

  const uploadingFiles = files.filter(f => f.status === 'uploading');
  const queuedFiles = files.filter(f => f.status === 'queued');
  const completedFiles = files.filter(f => f.status === 'success' || f.status === 'error');

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">Polaris Queue Uploader</CardTitle>
        <CardDescription>Drag & drop files to upload with a queue. Max {MAX_CONCURRENT_UPLOADS} uploads at a time.</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
            isDragging ? "border-primary bg-accent/20" : "border-border hover:border-primary/50"
          )}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <UploadCloud className="w-10 h-10 mb-4 text-muted-foreground" />
            <p className="mb-2 text-sm text-muted-foreground">
              <span className="font-semibold text-primary">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">Any file type, up to you</p>
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelect} />
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <ScrollArea className="h-72 w-full pr-4">
              <div className="space-y-6">
                {uploadingFiles.length > 0 && <FileListSection title="Uploading" files={uploadingFiles} onRemoveFile={removeFile} />}
                {queuedFiles.length > 0 && <FileListSection title="In Queue" files={queuedFiles} onRemoveFile={removeFile} />}
                {completedFiles.length > 0 && <FileListSection title="Completed" files={completedFiles} onRemoveFile={removeFile} />}
              </div>
            </ScrollArea>
             {completedFiles.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm" onClick={clearCompleted}>
                  Clear Completed
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


interface FileListSectionProps {
  title: string;
  files: UploadableFile[];
  onRemoveFile: (id: string) => void;
}

const FileListSection: FC<FileListSectionProps> = ({ title, files, onRemoveFile }) => (
  <div>
    <h3 className="text-lg font-medium tracking-tight mb-2">{title}</h3>
    <Separator className="mb-4" />
    <div className="space-y-4">
      {files.map(file => (
        <FileListItem key={file.id} file={file} onRemove={onRemoveFile} />
      ))}
    </div>
  </div>
);


interface FileListItemProps {
  file: UploadableFile;
  onRemove: (id: string) => void;
}

const FileListItem: FC<FileListItemProps> = ({ file, onRemove }) => {
  const getStatusBadge = () => {
    switch(file.status) {
      case 'queued':
        return <Badge variant="secondary">Queued {file.retryCount > 0 && `(Retry ${file.retryCount})`}</Badge>;
      case 'uploading':
        return <Badge variant="default" className="bg-blue-500 hover:bg-blue-600">Uploading</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-600">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-4 truncate">
        {file.status === 'success' ? <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" /> : <FileIcon className="h-6 w-6 text-muted-foreground shrink-0" />}
        <div className="truncate">
          <p className="text-sm font-medium truncate">{file.file.name}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(file.file.size)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {file.status === 'uploading' && (
          <div className="w-28">
            <Progress value={file.progress} className="h-2" />
            <p className="text-xs text-right text-muted-foreground">{file.progress}%</p>
          </div>
        )}
        {file.status !== 'uploading' && getStatusBadge()}
        {file.status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove(file.id)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
