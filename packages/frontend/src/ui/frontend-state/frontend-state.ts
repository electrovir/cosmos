import {assertWrap, check} from '@augment-vir/assert';
import {attachOnResize, Observable} from 'element-vir';
import {type FullSpaRoute, PathTree, SpaRouter} from 'spa-router-vir';
import {joinUrlPaths, parseUrl} from 'url-vir';
import {ViraThemeClient, ViraThemeSelection} from 'vira';
import {bodyCatalog} from '../../data/body-catalog.js';
import {BodyId, BodyKind, isCutOpenByBodyId} from '../../data/celestial-body.js';
import {FocusScale} from '../focus-scale.js';
import {createCosmosLocalDbClient} from './frontend-clients/local-db.client.js';
import {determineScreenSize} from './screen-size.js';

export const frontendPathTree = new PathTree({
    allowBare: true,
    children: {
        ':scale': {
            allowBare: true,
            children: {
                ':body-name': {
                    allowBare: true,
                    children: {
                        /** A moon of the named body, or else the named body's selected layer. */
                        ':child-name': {
                            allowBare: true,
                            children: {
                                ':layer-name': {},
                            },
                        },
                    },
                },
            },
        },
    },
});

const routerBasePath = 'cosmos';

/**
 * Absolute URL path to a file in `www-static`. Includes the router's base path only when the
 * current URL does, matching how the router builds its own URLs.
 */
export function createStaticFileUrl(...paths: ReadonlyArray<string>) {
    return joinUrlPaths(
        '',
        ...(parseUrl(globalThis.location.href).paths[0] === routerBasePath
            ? [
                  routerBasePath,
              ]
            : []),
        ...paths,
    );
}

export type FrontendPaths = Readonly<typeof frontendPathTree.PathsType>;
export type FrontendRoute = Readonly<FullSpaRoute<FrontendPaths, undefined, undefined>>;
export type FrontendRouter = SpaRouter<FrontendPaths>;

function findViewableBody(name: string | undefined) {
    return check.isEnumValue(name, BodyId) ? name : undefined;
}

/**
 * The route's scale, the body the view centers on, and the selected layer. A moon follows its
 * planet in the path, as in `/planet/earth/moon`. Unknown scales give a close-up and unknown body
 * names give Earth. Wider than a planet's moons, a moon gives way to its planet.
 */
export function getRouteFocus(route: Readonly<Pick<FullSpaRoute<FrontendPaths>, 'paths'>>) {
    const scaleName = route.paths[0];
    const scale =
        check.isEnumValue(scaleName, FocusScale) && scaleName !== FocusScale.Body
            ? scaleName
            : FocusScale.Body;
    const namedBodyId = findViewableBody(route.paths[1]) ?? BodyId.Earth;
    const childId =
        scale === FocusScale.Body || scale === FocusScale.Moons
            ? findViewableBody(route.paths[2])
            : undefined;
    const moonId = childId && bodyCatalog[childId].parentId === namedBodyId ? childId : undefined;
    const bodyId = moonId ?? namedBodyId;
    return {
        scale,
        bodyId,
        /** Not checked against the body's layers, which load later. */
        layerId:
            scale === FocusScale.Body && isCutOpenByBodyId[bodyId]
                ? route.paths[moonId ? 3 : 2] || undefined
                : undefined,
    };
}

export function createFocusRoute({
    scale,
    bodyId,
    layerId,
}: Readonly<{
    scale: FocusScale;
    bodyId: BodyId;
    /** Only used for a close-up. */
    layerId: string | undefined;
}>): FrontendRoute {
    const summary = bodyCatalog[bodyId];
    const planetId =
        summary.kind === BodyKind.Moon ? assertWrap.isDefined(summary.parentId) : bodyId;
    const planetPath = frontendPathTree.paths.children[':scale']
        .fill(scale === FocusScale.Body ? bodyCatalog[planetId].kind : scale)
        .children[':body-name'].fill(planetId);
    const shownLayerId = scale === FocusScale.Body ? layerId : undefined;
    const moonPath =
        planetId === bodyId ? undefined : planetPath.children[':child-name'].fill(bodyId);
    const paths = moonPath
        ? shownLayerId
            ? moonPath.children[':layer-name'].fill(shownLayerId).fullPaths
            : moonPath.fullPaths
        : shownLayerId
          ? planetPath.children[':child-name'].fill(shownLayerId).fullPaths
          : planetPath.fullPaths;
    return {
        paths,
        search: undefined,
        hash: undefined,
    };
}

export async function createFrontendState(hostElement: Readonly<HTMLElement>) {
    const localDbClient = await createCosmosLocalDbClient();
    const router: FrontendRouter = new SpaRouter({
        basePath: routerBasePath,
        sanitizeRoute(rawRoute) {
            return createFocusRoute(
                getRouteFocus({
                    paths: frontendPathTree.sanitizePaths(rawRoute.paths),
                }),
            );
        },
    });

    const themeClient = new ViraThemeClient();
    themeClient.setSelectedTheme(ViraThemeSelection.Dark);

    const frontendState = new Observable({
        equalityCheck: check.strictEquals,
        defaultValue: {
            router,
            localDbClient,
            themeClient,
            currentRoute: router.readCurrentRoute(),
            screenSize: determineScreenSize({
                currentScreenSize: undefined,
                elementWidth: hostElement.clientWidth,
            }),
            hostResizeObserver: undefined satisfies ResizeObserver | undefined as
                | ResizeObserver
                | undefined,
        },
    });

    router.listen(true, (currentRoute) => {
        globalThis.document.title = bodyCatalog[getRouteFocus(currentRoute).bodyId].name;
        frontendState.setValue({
            ...frontendState.value,
            currentRoute,
        });
    });

    const {resizeObserver} = attachOnResize(hostElement, ({contentRect}) => {
        const screenSize = determineScreenSize({
            currentScreenSize: frontendState.value.screenSize,
            elementWidth: contentRect.width,
        });
        if (screenSize !== frontendState.value.screenSize) {
            frontendState.setValue({
                ...frontendState.value,
                screenSize,
            });
        }
    });
    frontendState.setValue({
        ...frontendState.value,
        hostResizeObserver: resizeObserver,
    });

    return frontendState;
}

export type FrontendStateObservable = Awaited<ReturnType<typeof createFrontendState>>;
