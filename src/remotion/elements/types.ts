import React from 'react';

/**
 * Standard Element Categories based on Remotion Element Library conventions
 */
export type ElementCategory =
  | 'Komponen Pengguna'
  | 'Animated Typography'
  | 'Lower Thirds'
  | 'Captions & Subtitles'
  | 'Transitions'
  | 'Backgrounds'
  | 'Infographics'
  | 'Charts & Data Visualization'
  | 'Shapes & Decorative Elements'
  | 'Social Media Elements';

export type PropFieldType = 'text' | 'number' | 'color' | 'select' | 'boolean';

export interface ElementPropField {
  name: string;
  label: string;
  type: PropFieldType;
  defaultValue: any;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export interface ElementDependency {
  name: string;
  version: string | null;
}

/**
 * Conforms to Remotion Studio Protocol Element Definition & Payload
 * (as in @remotion/studio-protocol createElementPayload)
 */
export interface RemotionElementDefinition<TProps = any> {
  slug: string;
  displayName: string;
  category: ElementCategory;
  tags: string[];
  description: string;
  dimensions: {
    width: number;
    height: number;
  };
  durationInFrames: number;
  fps: number;
  dependencies: ElementDependency[];
  initialProps: TProps;
  propsSchema: ElementPropField[];
  sourceCode: string;
  component?: React.ComponentType<TProps>;
  lazyComponent?: () => Promise<{ default: React.ComponentType<any> }>;
  previewBackdrop?: string;
  isInstalled?: boolean;
  isUserCreated?: boolean;
}
