/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 */

export interface IBaseEntityOptions {
    readonly description?: string;
    readonly displayName?: string;
    readonly name: string;
}

export abstract class BaseEntity {
    public readonly description?: string;
    public readonly displayName?: string;
    public readonly name: string;

    constructor(options: IBaseEntityOptions) {
        this.description = options.description ?? undefined;
        this.displayName = options.displayName ?? undefined;
        this.name = options.name;
    }
}
