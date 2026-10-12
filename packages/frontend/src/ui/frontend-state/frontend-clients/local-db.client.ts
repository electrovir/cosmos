import {LocalDbClient} from 'local-db-client';
import {renderQualityShape} from '../../three/render-quality.js';

export async function createCosmosLocalDbClient() {
    return await LocalDbClient.createClient(
        {
            /** The last render quality the frame rate settled on, so a reload starts there. */
            settledRenderQuality: {
                shape: renderQualityShape,
            },
        },
        {
            storeName: 'cosmos',
        },
    );
}

export type CosmosLocalDbClient = Awaited<ReturnType<typeof createCosmosLocalDbClient>>;
