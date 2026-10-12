import {type PartialWithUndefined} from '@augment-vir/common';
import {css, defineElement, defineElementEvent, html, onResize} from 'element-vir';
import {LoaderAnimated24Icon, ViraIcon} from 'vira';
import {type BodyDetails, type BodyId} from '../../data/celestial-body.js';
import {defaultFieldOpacity} from '../field-opacity.js';
import {type FocusScale} from '../focus-scale.js';
import {type BodyAssets} from '../three/body-assets.js';
import {type BodyPick, type CosmosScene, type SceneReadout} from '../three/cosmos-scene.js';
import {type RenderQuality} from '../three/render-quality.js';

export const VirBodyViewer = defineElement<
    {
        /** While `undefined`, a spinner shows over whichever body was last shown. */
        body:
            | Readonly<{
                  details: Readonly<BodyDetails>;
                  assets: BodyAssets;
              }>
            | undefined;
        /** How many times faster than real time the shown time runs. */
        timeSpeed: number;
        focusScale: FocusScale;
    } & PartialWithUndefined<{
        /** Only read when the viewer is first created. After that the viewer adjusts it itself. */
        initialRenderQuality: Readonly<RenderQuality>;
        /** Width covered by other UI on the right, which the body is centered beside. */
        rightInsetPixels: number;
        selectedLayerId: string;
        /** From 0 to 1. */
        magneticFieldOpacity: number;
    }>
>()({
    tagName: 'vir-body-viewer',
    events: {
        renderQualityChange: defineElementEvent<Readonly<RenderQuality>>(),
        /** Tapping the body picks a layer. `undefined` when a tap clears the selection. */
        layerPick: defineElementEvent<Readonly<BodyPick> | undefined>(),
        readout: defineElementEvent<Readonly<SceneReadout>>(),
        /** Tapping a body beside the focused one, or the focused one when zoomed out. */
        bodyTap: defineElementEvent<BodyId>(),
        /** Zooming crossed into another scale. */
        focusScaleChange: defineElementEvent<FocusScale>(),
    },
    styles: css`
        :host {
            display: block;
            position: relative;
            cursor: grab;
        }

        :host(:active) {
            cursor: grabbing;
        }

        canvas {
            display: block;
            width: 100%;
            height: 100%;
            touch-action: none;
        }

        .loading {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            pointer-events: none;
            visibility: hidden;
            animation: show-loading 0s 500ms forwards;

            & ${ViraIcon} {
                width: 64px;
                height: 64px;
            }
        }

        @keyframes show-loading {
            to {
                visibility: visible;
            }
        }
    `,
    state() {
        return {
            cosmosScene: undefined satisfies CosmosScene | undefined as CosmosScene | undefined,
        };
    },
    init({state, updateState, inputs, dispatch, events, host}) {
        void import('../three/cosmos-scene.js').then(({createCosmosScene}) => {
            if (!host.isConnected || state.cosmosScene) {
                return;
            }
            const cosmosScene = createCosmosScene();
            void import('../three/body-assets.js')
                .then(({loadStarCatalog}) => loadStarCatalog())
                .then((stars) => {
                    cosmosScene.setStars(stars);
                });
            /** The resize observer may have already fired before the scene existed. */
            cosmosScene.resize(host.getBoundingClientRect());
            if (inputs.initialRenderQuality) {
                cosmosScene.setRenderQuality(inputs.initialRenderQuality);
            }
            cosmosScene.listenToRenderQuality((quality) => {
                dispatch(
                    new events.renderQualityChange({
                        detail: quality,
                    }),
                );
            });
            cosmosScene.listenToPick((pick) => {
                dispatch(
                    new events.layerPick({
                        detail: pick,
                    }),
                );
            });
            cosmosScene.listenToBodyTap((bodyId) => {
                dispatch(
                    new events.bodyTap({
                        detail: bodyId,
                    }),
                );
            });
            cosmosScene.listenToFocusScale((focusScale) => {
                dispatch(
                    new events.focusScaleChange({
                        detail: focusScale,
                    }),
                );
            });
            cosmosScene.listenToReadout((readout) => {
                dispatch(
                    new events.readout({
                        detail: readout,
                    }),
                );
            });
            updateState({
                cosmosScene,
            });
        });
    },
    cleanup({state, updateState}) {
        state.cosmosScene?.dispose();
        updateState({
            cosmosScene: undefined,
        });
    },
    render({inputs, state}) {
        if (state.cosmosScene) {
            /**
             * Before the body, so a page that loads zoomed out starts there instead of building the
             * body's view at its close-up distance and flying out.
             */
            state.cosmosScene.setFocusScale(inputs.focusScale);
            if (inputs.body) {
                state.cosmosScene.setBody(inputs.body);
            }
            state.cosmosScene.setSelectedLayer(inputs.selectedLayerId);
            state.cosmosScene.setMagneticFieldOpacity(
                inputs.magneticFieldOpacity ?? defaultFieldOpacity,
            );
            state.cosmosScene.setTimeSpeed(inputs.timeSpeed);
            state.cosmosScene.setRightInset(inputs.rightInsetPixels ?? 0);
        }

        return html`
            <div
                style=${css`
                    height: 100%;
                `}
                ${onResize(({contentRect}) => {
                    state.cosmosScene?.resize(contentRect);
                })}
            >
                ${state.cosmosScene?.canvas}
            </div>
            ${state.cosmosScene && inputs.body
                ? ''
                : html`
                      <div
                          class="loading"
                          style=${css`
                              right: min(${inputs.rightInsetPixels ?? 0}px, 50%);
                          `}
                      >
                          <${ViraIcon.assign({
                              icon: LoaderAnimated24Icon,
                              fitContainer: true,
                          })}></${ViraIcon}>
                      </div>
                  `}
        `;
    },
});
