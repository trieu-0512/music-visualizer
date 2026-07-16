import type { ProjectConfigJson, ProjectRecord, VideoFormat } from "@music-visualizer/shared";
import type { ArtifactName } from "../../artifacts/index.js";

/**
 * Types for the folder-import pipeline (Architecture Upgrade PR-12).
 */

export interface ImportMetadata {
  songName: string;
  singerName: string;
  videoFormat: VideoFormat;
}

export interface FolderImportResult {
  project: ProjectRecord;
  readiness: {
    projectId: string;
    ready: boolean;
    present: string[];
    missing: string[];
  };
  config: ProjectConfigJson | null;
  artifacts: ArtifactName[];
}

export interface InspectedFolder {
  songName: string;
  assets: Map<string, Express.Multer.File>;
  generatedArtifacts: {
    lyrics?: Express.Multer.File;
    audioAnalysis?: Express.Multer.File;
  };
  metadataFile?: Express.Multer.File;
  missing: string[];
}

export interface ImportedMetadataFields {
  songName?: string;
  singerName?: string;
  videoFormat?: VideoFormat;
}
