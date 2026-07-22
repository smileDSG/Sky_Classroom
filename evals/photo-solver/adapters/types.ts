import type { AdapterResult, PhotoSolverCase } from '../types';

export interface PhotoSolverAdapter {
  run(testCase: PhotoSolverCase): Promise<AdapterResult>;
}
