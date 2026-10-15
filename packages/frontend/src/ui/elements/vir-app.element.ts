import {asyncProp, css, defineElement, html, listen, nothing} from 'element-vir';
import {lucideIcons, ViraButton, ViraColorVariant, ViraLink, ViraSize, viraTheme} from 'vira';
import {bodyCatalog, loadBodyDetails} from '../../data/body-catalog.js';
import {type BodyId} from '../../data/celestial-body.js';
import {defaultFieldOpacity} from '../field-opacity.js';
import {FocusScale} from '../focus-scale.js';
import {
    createFocusRoute,
    createFrontendState,
    type FrontendStateObservable,
    getRouteFocus,
} from '../frontend-state/frontend-state.js';
import {ScreenSize} from '../frontend-state/screen-size.js';
import {type BodyPick, type SceneReadout} from '../three/cosmos-scene.js';
import {defaultRenderQuality} from '../three/render-quality.js';
import {formatTimeSpeed, getTimeSpeed} from '../time-speed.js';
import {infoPanelWidthPixels, panelGapPixels, VirBodyPage} from './vir-body-page.element.js';
import {VirBodyViewer} from './vir-body-viewer.element.js';
import {VirSlider} from './vir-slider.element.js';

async function loadBody(bodyId: BodyId) {
    const [
        details,
        {loadBodyAssets},
    ] = await Promise.all([
        loadBodyDetails(bodyId),
        import('../three/body-assets.js'),
    ]);
    return {
        details,
        assets: await loadBodyAssets(bodyId),
    };
}

export const VirApp = defineElement()({
    tagName: 'vir-app',
    styles: css`
        :host,
        * {
            touch-action: none;
        }

        :host {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            position: relative;
            height: 100%;
            overflow: hidden;
            background-color: #000;
            color: ${viraTheme.colors['theme-default'].foreground.value};
            font-family: 'Atkinson Hyperlegible Next', ui-sans-serif, system-ui, sans-serif;
        }

        ${VirBodyViewer} {
            position: absolute;
            inset: 0;
        }

        .corner-buttons {
            position: relative;
            margin: 16px;
            display: flex;
            gap: 8px;
        }

        :host > ${ViraLink} {
            position: absolute;
            bottom: 16px;
            left: 16px;
        }

        .time-panel {
            position: relative;
            margin: 16px;
            width: 280px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            border-radius: 16px;
            background-color: rgba(0, 0, 0, 0.5);
        }
    `,
    state() {
        return {
            frontendState: undefined satisfies FrontendStateObservable | undefined as
                | FrontendStateObservable
                | undefined,
            body: asyncProp({
                updateCallback: loadBody,
            }),
            isFullscreen: !!globalThis.document.fullscreenElement,
            pickPoint: undefined satisfies BodyPick['point'] | undefined as
                | BodyPick['point']
                | undefined,
            readout: undefined satisfies SceneReadout | undefined as SceneReadout | undefined,
            /** From 0 (real time) to 1. */
            timeSpeedPosition: 0,
            magneticFieldOpacity: defaultFieldOpacity,
            documentListenerAbort: undefined satisfies AbortController | undefined as
                | AbortController
                | undefined,
        };
    },
    init({updateState, host}) {
        void createFrontendState(host).then((frontendState) => {
            updateState({
                frontendState,
            });
        });
        const documentListenerAbort = new AbortController();
        globalThis.document.addEventListener(
            'fullscreenchange',
            () => {
                updateState({
                    isFullscreen: !!globalThis.document.fullscreenElement,
                });
            },
            {
                signal: documentListenerAbort.signal,
            },
        );
        updateState({
            documentListenerAbort,
        });
    },
    cleanup({state}) {
        state.frontendState?.value.router.destroy();
        state.frontendState?.value.themeClient.destroy();
        state.frontendState?.value.hostResizeObserver?.disconnect();
        state.frontendState?.destroy();
        state.documentListenerAbort?.abort();
    },
    render({state, updateState}) {
        const frontendState = state.frontendState;
        if (!frontendState) {
            return nothing;
        }
        function toggleFullscreen() {
            void (globalThis.document.fullscreenElement
                ? globalThis.document.exitFullscreen()
                : globalThis.document.documentElement.requestFullscreen());
        }

        const {scale, bodyId, layerId} = getRouteFocus(frontendState.value.currentRoute);
        const isCloseUp = scale === FocusScale.Body;
        const timeSpeedText = formatTimeSpeed(getTimeSpeed(state.timeSpeedPosition));
        state.body.update(bodyId);
        const body =
            state.body.isResolved() && state.body.value.details.id === bodyId
                ? state.body.value
                : undefined;
        const selectedLayerId = body?.details.layers.some((layer) => {
            return layer.id === layerId && !layer.isHiddenInCut;
        })
            ? layerId
            : undefined;
        const isPhone = frontendState.value.screenSize === ScreenSize.Phone;
        /** Phones show a bottom panel over the bottom-left corner. */
        const hubLink = html`
            <${ViraLink.assign({
                link: {
                    url: 'https://electrovir.github.io/edu/',
                    newTab: false,
                },
                disableLinkStyles: true,
            })}>
                <${ViraButton.assign({
                    icon: lucideIcons.List,
                    color: ViraColorVariant.Neutral,
                    buttonSize: ViraSize.Large,
                })}
                    title="More apps"
                ></${ViraButton}>
            </${ViraLink}>
        `;

        function selectLayer(newLayerId: string | undefined) {
            frontendState?.value.router.setRoute(
                createFocusRoute({
                    scale: FocusScale.Body,
                    bodyId,
                    layerId: newLayerId,
                }),
            );
        }

        return html`
            <${VirBodyViewer.assign({
                body,
                timeSpeed: getTimeSpeed(state.timeSpeedPosition),
                focusScale: scale,
                // initialRenderQuality: frontendState.value.localDbClient.value.settledRenderQuality,
                initialRenderQuality: defaultRenderQuality,
                /**
                 * Only the info panel, with its margin on both sides, at every zoom level so the
                 * body stays put while the panels change.
                 */
                rightInsetPixels: isPhone ? 0 : infoPanelWidthPixels + 2 * panelGapPixels,
                selectedLayerId,
                magneticFieldOpacity: state.magneticFieldOpacity,
            })}
                ${listen(VirBodyViewer.events.renderQualityChange, (event) => {
                    void frontendState.value.localDbClient.set.settledRenderQuality(event.detail);
                })}
                ${listen(VirBodyViewer.events.layerPick, (event) => {
                    if (!isCloseUp) {
                        return;
                    }
                    /** A `CustomEvent` turns an `undefined` detail into `null`. */
                    const pick = event.detail || undefined;
                    updateState({
                        pickPoint: pick?.point,
                    });
                    selectLayer(pick?.layer.id);
                })}
                ${listen(VirBodyViewer.events.bodyTap, (event) => {
                    updateState({
                        pickPoint: undefined,
                    });
                    frontendState.value.router.setRoute(
                        createFocusRoute({
                            scale: FocusScale.Body,
                            bodyId: event.detail,
                            layerId: undefined,
                        }),
                    );
                })}
                ${listen(VirBodyViewer.events.focusScaleChange, (event) => {
                    frontendState.value.router.setRoute(
                        createFocusRoute({
                            scale: event.detail,
                            bodyId,
                            layerId: undefined,
                        }),
                        {
                            replace: true,
                        },
                    );
                })}
                ${listen(VirBodyViewer.events.readout, (event) => {
                    updateState({
                        readout: event.detail,
                    });
                })}
            ></${VirBodyViewer}>
            <div class="corner-buttons">
                ${globalThis.document.fullscreenEnabled
                    ? html`
                          <${ViraButton.assign({
                              icon: state.isFullscreen
                                  ? lucideIcons.Minimize
                                  : lucideIcons.Maximize,
                              color: ViraColorVariant.Neutral,
                              buttonSize: ViraSize.Large,
                          })}
                              title=${state.isFullscreen ? 'Exit full screen' : 'Full screen'}
                              ${listen('click', toggleFullscreen)}
                          ></${ViraButton}>
                      `
                    : nothing}
                ${isPhone ? hubLink : nothing}
            </div>
            ${isPhone ? nothing : hubLink}
            ${isCloseUp
                ? html`
                      <${VirBodyPage.assign({
                          summary: bodyCatalog[bodyId],
                          details: body?.details,
                          isLoadFailed: state.body.isError(),
                          timeSpeedPosition: state.timeSpeedPosition,
                          selectedLayerId,
                          pickPoint: state.pickPoint,
                          readout: state.readout,
                          magneticFieldOpacity: state.magneticFieldOpacity,
                          isPhone,
                      })}
                          ${listen(VirBodyPage.events.layerSelect, (event) => {
                              updateState({
                                  pickPoint: undefined,
                              });
                              selectLayer(event.detail || undefined);
                          })}
                          ${listen(VirBodyPage.events.magneticFieldOpacityChange, (event) => {
                              updateState({
                                  magneticFieldOpacity: event.detail,
                              });
                          })}
                          ${listen(VirBodyPage.events.timeSpeedPositionChange, (event) => {
                              updateState({
                                  timeSpeedPosition: event.detail,
                              });
                          })}
                      ></${VirBodyPage}>
                  `
                : html`
                      <div class="time-panel">
                          <span>Time speed: ${timeSpeedText}</span>
                          <${VirSlider.assign({
                              value: state.timeSpeedPosition,
                              label: 'Time speed',
                              valueText: timeSpeedText,
                          })}
                              ${listen(VirSlider.events.valueChange, (event) => {
                                  updateState({
                                      timeSpeedPosition: event.detail,
                                  });
                              })}
                          ></${VirSlider}>
                      </div>
                  `}
        `;
    },
});
