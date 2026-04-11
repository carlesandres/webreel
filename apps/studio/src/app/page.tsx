"use client";

import { useState, useCallback, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai/react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { LeftPane } from "@/components/left-pane";
import { Preview } from "@/components/preview";
import { PropsPane } from "@/components/props-pane";
import { Header } from "@/components/header";
import { CommandPalette } from "@/components/command-palette";
import { GlobalSettings } from "@/components/global-settings";
import { Separator } from "@/components/ui/separator";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  configJsonAtom,
  savedConfigJsonAtom,
  fileHandleAtom,
  fileNameAtom,
  commitConfigAtom,
  DEFAULT_CONFIG,
  renderStatusAtom,
  parsedConfigAtom,
  selectedVideoAtom,
} from "@/store/config";

export default function StudioPage() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [configJson, setConfigJson] = useAtom(configJsonAtom);
  const [savedConfigJson, setSavedConfigJson] = useAtom(savedConfigJsonAtom);
  const [fileHandle, setFileHandle] = useAtom(fileHandleAtom);
  const [fileName, setFileName] = useAtom(fileNameAtom);
  const commit = useSetAtom(commitConfigAtom);
  const renderStatus = useAtomValue(renderStatusAtom);
  const { config } = useAtomValue(parsedConfigAtom);
  const selectedVideo = useAtomValue(selectedVideoAtom);

  const hasFileSystemAccess =
    typeof window !== "undefined" && "showOpenFilePicker" in window;

  const handleSave = useCallback(async () => {
    if (fileHandle) {
      try {
        const writable = await fileHandle.createWritable();
        await writable.write(configJson);
        await writable.close();
        setSavedConfigJson(configJson);
      } catch {}
    } else if (hasFileSystemAccess) {
      try {
        const handle = await (
          window as unknown as {
            showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
          }
        ).showSaveFilePicker({
          suggestedName: fileName ?? "webreel.config.json",
          types: [
            { description: "Webreel Config", accept: { "application/json": [".json"] } },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(configJson);
        await writable.close();
        setSavedConfigJson(configJson);
        setFileHandle(handle);
        setFileName(handle.name);
      } catch {}
    } else {
      const blob = new Blob([configJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName ?? "webreel.config.json";
      a.click();
      URL.revokeObjectURL(url);
      setSavedConfigJson(configJson);
    }
  }, [
    fileHandle,
    hasFileSystemAccess,
    configJson,
    fileName,
    setSavedConfigJson,
    setFileHandle,
    setFileName,
  ]);

  const handleOpen = useCallback(async () => {
    if (hasFileSystemAccess) {
      try {
        const [handle] = await (
          window as unknown as {
            showOpenFilePicker: (opts: unknown) => Promise<FileSystemFileHandle[]>;
          }
        ).showOpenFilePicker({
          types: [
            { description: "Webreel Config", accept: { "application/json": [".json"] } },
          ],
          multiple: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        commit(text);
        setSavedConfigJson(text);
        setFileHandle(handle);
        setFileName(file.name);
      } catch {}
    }
  }, [hasFileSystemAccess, commit, setSavedConfigJson, setFileHandle, setFileName]);

  const handleNew = useCallback(() => {
    commit(DEFAULT_CONFIG);
    setSavedConfigJson(DEFAULT_CONFIG);
    setFileHandle(null);
    setFileName(null);
  }, [commit, setSavedConfigJson, setFileHandle, setFileName]);

  const handleStartRender = useCallback(async () => {
    if (renderStatus === "running" || !config || !selectedVideo) return;
    // Trigger via custom event that Preview component listens to
    window.dispatchEvent(new CustomEvent("webreel:start-render"));
  }, [renderStatus, config, selectedVideo]);

  useKeyboardShortcuts({
    onSave: handleSave,
    onOpen: handleOpen,
    onCommandPalette: () => setCmdPaletteOpen(true),
    onStartRender: handleStartRender,
  });

  if (isDesktop) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <Header
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenCommandPalette={() => setCmdPaletteOpen(true)}
        />
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
          <ResizablePanel id="left" defaultSize="25%" minSize="15%" maxSize="40%">
            <LeftPane />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="preview" defaultSize="50%" minSize="25%">
            <Preview />
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="props" defaultSize="25%" minSize="15%" maxSize="40%">
            <PropsPane />
          </ResizablePanel>
        </ResizablePanelGroup>
        <CommandPalette
          open={cmdPaletteOpen}
          onOpenChange={setCmdPaletteOpen}
          onSave={handleSave}
          onOpen={handleOpen}
          onNew={handleNew}
          onStartRender={handleStartRender}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <GlobalSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenCommandPalette={() => setCmdPaletteOpen(true)}
      />
      <Tabs defaultValue="timeline" className="min-h-0 flex-1">
        <div className="shrink-0 px-2 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="props">Properties</TabsTrigger>
          </TabsList>
        </div>
        <Separator className="mt-2" />
        <TabsContent value="timeline" className="min-h-0 overflow-hidden">
          <LeftPane />
        </TabsContent>
        <TabsContent value="preview" className="min-h-0 overflow-hidden">
          <Preview />
        </TabsContent>
        <TabsContent value="props" className="min-h-0 overflow-hidden">
          <PropsPane />
        </TabsContent>
      </Tabs>
      <CommandPalette
        open={cmdPaletteOpen}
        onOpenChange={setCmdPaletteOpen}
        onSave={handleSave}
        onOpen={handleOpen}
        onNew={handleNew}
        onStartRender={handleStartRender}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <GlobalSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
