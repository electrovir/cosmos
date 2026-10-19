import {type PartialWithUndefined} from '@augment-vir/common';
import {createFullDateInUserTimezone, toLocaleString} from 'date-vir';
import {
    css,
    defineElement,
    defineElementEvent,
    html,
    listen,
    nothing,
    onResize,
    unsafeCSS,
} from 'element-vir';
import {
    createSizedIcon,
    lucideIcons,
    ViraButton,
    ViraColorVariant,
    viraIconCssVars,
    ViraSize,
} from 'vira';
import {
    type BodyDetails,
    type BodyLayer,
    type BodySummary,
    isCutOpenByBodyId,
    LayerRegion,
    MatterState,
    type ValueRange,
} from '../../data/celestial-body.js';
import {getBodyStats} from '../body-stats.js';
import {createStaticFileUrl} from '../frontend-state/frontend-state.js';
import {playPronunciation} from '../pronunciation.js';
import {type BodyPick, type SceneReadout} from '../three/cosmos-scene.js';
import {formatTimeSpeed, getTimeSpeed} from '../time-speed.js';
import {VirSlider} from './vir-slider.element.js';

const matterStateLabels: Readonly<Record<MatterState, string>> = {
    [MatterState.Solid]: 'Solid',
    [MatterState.Liquid]: 'Liquid',
    [MatterState.Gas]: 'Gas',
    [MatterState.Plasma]: 'Plasma',
};

export const infoPanelWidthPixels = 320;
export const panelGapPixels = 16;
/** The panels collapse into one when side by side they'd take more than this share of the app. */
const maxPanelsWidthShare = 0.5;

const numberFormat = new Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 3,
});

function formatRange({min, max}: Readonly<ValueRange>, unit: string) {
    return min === max
        ? `${numberFormat.format(min)} ${unit}`
        : `${numberFormat.format(min)}–${numberFormat.format(max)} ${unit}`;
}

/** Atmosphere layers are measured up from the surface, everything else down from it. */
function getLayerPlacement({
    layer,
    surfaceRadiusKm,
}: Readonly<{
    layer: Readonly<BodyLayer>;
    surfaceRadiusKm: number;
}>) {
    return layer.region === LayerRegion.Atmosphere
        ? {
              label: 'Altitude',
              value: formatRange(
                  {
                      min: layer.radiusKm.min - surfaceRadiusKm,
                      max: layer.radiusKm.max - surfaceRadiusKm,
                  },
                  'km',
              ),
          }
        : {
              label: 'Depth',
              value: formatRange(
                  {
                      min: Math.max(0, surfaceRadiusKm - layer.radiusKm.max),
                      max: surfaceRadiusKm - layer.radiusKm.min,
                  },
                  'km',
              ),
          };
}

function formatPickPoint({latitudeDegrees, longitudeDegrees, altitudeKm}: BodyPick['point']) {
    return [
        `${Math.abs(latitudeDegrees).toFixed(1)}° ${latitudeDegrees < 0 ? 'S' : 'N'}`,
        `${Math.abs(longitudeDegrees).toFixed(1)}° ${longitudeDegrees < 0 ? 'W' : 'E'}`,
        altitudeKm < 0
            ? `${numberFormat.format(-altitudeKm)} km deep`
            : `${numberFormat.format(altitudeKm)} km up`,
    ].join(' · ');
}

/**
 * One body's layers and controls, laid over the 3D viewer. The viewer stays outside this page so
 * its 3D scene survives visits to other pages.
 */
export const VirBodyPage = defineElement<
    {
        summary: Readonly<BodySummary>;
        /** `undefined` while loading. */
        details: Readonly<BodyDetails> | undefined;
        /** From 0 (real time) to 1. */
        timeSpeedPosition: number;
        /** From 0 to 1. */
        magneticFieldOpacity: number;
    } & PartialWithUndefined<{
        isLoadFailed: boolean;
        selectedLayerId: string;
        /** Where the selected layer was tapped, if it was picked by tapping. */
        pickPoint: BodyPick['point'];
        readout: Readonly<SceneReadout>;
        /** Turns the overlay into a bar along the bottom. */
        isPhone: boolean;
    }>
>()({
    tagName: 'vir-body-page',
    events: {
        /** The overlay's content width, which the 3D viewer centers the body beside. */
        /** `undefined` clears the selection. */
        layerSelect: defineElementEvent<string | undefined>(),
        magneticFieldOpacityChange: defineElementEvent<number>(),
        timeSpeedPositionChange: defineElementEvent<number>(),
    },
    state() {
        return {
            /** The app's width, which the panels together may only take a share of. */
            appWidth: 0,
            /** The layers panel's width from when it was last shown on its own. */
            layersPanelWidth: 0,
        };
    },
    hostClasses: {
        'vir-body-page-phone'({inputs}) {
            return !!inputs.isPhone;
        },
    },
    styles({hostClasses}) {
        return css`
            :host {
                /** Lays the overlay out in the app's own flex row, beside its corner buttons. */
                display: contents;
            }

            .panels {
                /** Positioned so it paints above the absolutely positioned viewer. */
                position: relative;
                align-self: stretch;
                margin: 16px;
                display: flex;
                align-items: flex-start;
                gap: ${panelGapPixels}px;
                /** Lets drags in the empty space beneath the panels reach the viewer. */
                pointer-events: none;
            }

            .overlay {
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-height: 100%;
                box-sizing: border-box;
                pointer-events: auto;
                padding: 16px;
                border-radius: 16px;
                background-color: rgba(0, 0, 0, 0.5);
                overflow-y: auto;

                &,
                & * {
                    touch-action: pan-y;
                }

                & h1,
                & h2,
                & p {
                    margin: 0;
                }

                & h2 {
                    font-size: 1.1em;
                }
            }

            .name-row {
                display: flex;
                align-items: flex-start;
                gap: 8px;

                & h1 {
                    min-width: 0;
                    hyphens: auto;
                    overflow-wrap: anywhere;
                }

                & ${ViraButton} {
                    flex-shrink: 0;
                    ${viraIconCssVars['vira-icon-stroke-width'].name}: 1.5px;
                }
            }

            .sizer {
                position: absolute;
                inset: 0;
                visibility: hidden;
                pointer-events: none;
            }

            .info {
                width: ${infoPanelWidthPixels}px;
                min-width: 0;
            }

            .layers {
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                gap: 2px;

                & button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 4px 8px;
                    border: none;
                    border-radius: 6px;
                    background: none;
                    color: inherit;
                    font: inherit;
                    text-align: start;
                    cursor: pointer;

                    &:hover {
                        background-color: rgba(255, 255, 255, 0.1);
                    }

                    &.selected {
                        background-color: rgba(255, 255, 255, 0.2);
                    }
                }

                & .swatch {
                    width: 14px;
                    height: 14px;
                    flex-shrink: 0;
                    border-radius: 3px;
                }
            }

            ${hostClasses['vir-body-page-phone'].selector} .panels {
                position: absolute;
                left: 0;
                right: 0;
                bottom: 0;
                margin: 8px;
                flex-direction: column;
                align-items: stretch;
                gap: 8px;
                max-width: none;
                max-height: 40%;

                & .overlay {
                    width: auto;
                    min-height: 0;
                    flex-shrink: 1;
                }
            }

            table {
                border-collapse: collapse;

                & th,
                & td {
                    padding: 2px 0;
                    vertical-align: top;
                    text-align: start;
                }

                & th {
                    padding-right: 16px;
                    font-weight: normal;
                    opacity: 0.7;
                    white-space: nowrap;
                }
            }

            .controls {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .slider-field {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .muted {
                opacity: 0.7;
            }
        `;
    },
    render({inputs, state, updateState, dispatch, events}) {
        const details = inputs.details;
        const isCutOpen = isCutOpenByBodyId[inputs.summary.id];
        const selectedLayer = isCutOpen
            ? details?.layers.find((layer) => layer.id === inputs.selectedLayerId)
            : undefined;
        const timeSpeed = getTimeSpeed(inputs.timeSpeedPosition);
        const isLayersPanelCollapsed =
            !!inputs.isPhone ||
            state.layersPanelWidth + panelGapPixels + infoPanelWidthPixels >
                state.appWidth * maxPanelsWidthShare;

        function renderLayerDetails(layer: Readonly<BodyLayer>) {
            const placement = getLayerPlacement({
                layer,
                surfaceRadiusKm: inputs.summary.radiusKm,
            });
            const rows = [
                {
                    label: placement.label,
                    value: placement.value,
                },
                {
                    label: 'State',
                    value: matterStateLabels[layer.state],
                },
                {
                    label: 'Made of',
                    value: layer.composition,
                },
                {
                    label: 'Temperature',
                    value: layer.temperatureKelvin && formatRange(layer.temperatureKelvin, 'K'),
                },
                {
                    label: 'Density',
                    value:
                        layer.densityGramsPerCubicCentimeter &&
                        formatRange(layer.densityGramsPerCubicCentimeter, 'g/cm³'),
                },
                {
                    label: 'Pressure',
                    value:
                        layer.pressureGigapascals && formatRange(layer.pressureGigapascals, 'GPa'),
                },
                {
                    label: 'Tapped at',
                    value: inputs.pickPoint && formatPickPoint(inputs.pickPoint),
                },
            ].filter((row) => row.value);
            return html`
                <h2>${layer.name}</h2>
                <p>${layer.description}</p>
                <table>
                    ${rows.map((row) => {
                        return html`
                            <tr>
                                <th>${row.label}</th>
                                <td>${row.value}</td>
                            </tr>
                        `;
                    })}
                </table>
            `;
        }

        function renderLayerButtons(bodyDetails: Readonly<BodyDetails>) {
            return bodyDetails.layers
                .filter((layer) => !layer.isHiddenInCut)
                .toReversed()
                .map((layer) => {
                    return html`
                        <button
                            class=${layer.id === inputs.selectedLayerId ? 'selected' : ''}
                            ${listen('click', () => {
                                dispatch(
                                    new events.layerSelect({
                                        detail:
                                            layer.id === inputs.selectedLayerId
                                                ? undefined
                                                : layer.id,
                                    }),
                                );
                            })}
                        >
                            <span
                                class="swatch"
                                style=${css`
                                    background-color: ${unsafeCSS(layer.color)};
                                `}
                            ></span>
                            ${layer.name}
                        </button>
                    `;
                });
        }

        function sayName() {
            void playPronunciation(
                createStaticFileUrl('pronunciations', `${inputs.summary.id}.mp3`),
            );
        }

        function renderReadout(readout: Readonly<SceneReadout>) {
            return html`
                <table>
                    <tr>
                        <th>Time</th>
                        <td>
                            ${toLocaleString(
                                createFullDateInUserTimezone(readout.unixMilliseconds),
                                {
                                    dateStyle: 'medium',
                                    timeStyle: 'medium',
                                },
                            )}
                        </td>
                    </tr>
                </table>
            `;
        }

        return html`
            <div
                class="sizer"
                ${onResize(({contentRect}) => {
                    updateState({
                        appWidth: contentRect.width,
                    });
                })}
            ></div>
            <div class="panels">
                ${details && isCutOpen && !isLayersPanelCollapsed
                    ? html`
                          <div
                              class="overlay layers"
                              ${onResize(({contentRect}) => {
                                  updateState({
                                      /** Adds the panel's padding on both sides. */
                                      layersPanelWidth: contentRect.width + 32,
                                  });
                              })}
                          >
                              ${renderLayerButtons(details)}
                          </div>
                      `
                    : nothing}
                <div class="overlay info">
                    <div class="name-row">
                        <${ViraButton.assign({
                            icon: createSizedIcon(lucideIcons.Speech, 24),
                            color: ViraColorVariant.Neutral,
                            buttonSize: ViraSize.Large,
                        })}
                            title="Say the name"
                            ${
                                /**
                                 * `pointerup` instead of `click`: touch browsers withhold a tap's
                                 * `click` in some states, such as while another touch is down, but
                                 * still send its `pointerup`.
                                 */
                                listen('pointerup', (event) => {
                                    if (event.button === 0) {
                                        sayName();
                                    }
                                })
                            }
                            ${
                                /** Keyboard activation is the only `click` whose `detail` is `0`. */
                                listen('click', (event) => {
                                    if (!event.detail) {
                                        sayName();
                                    }
                                })
                            }
                        ></${ViraButton}>
                        <h1>${inputs.summary.name}</h1>
                    </div>
                    ${details
                        ? html`
                              ${details.description.split('\n\n').map((paragraph) => {
                                  return html`
                                      <p>${paragraph}</p>
                                  `;
                              })}
                              <table>
                                  ${getBodyStats({
                                      summary: inputs.summary,
                                      details,
                                  }).map((stat) => {
                                      return html`
                                          <tr>
                                              <th>${stat.label}</th>
                                              <td>${stat.value}</td>
                                          </tr>
                                      `;
                                  })}
                              </table>
                              ${isCutOpen && isLayersPanelCollapsed
                                  ? html`
                                        <div class="layers">${renderLayerButtons(details)}</div>
                                    `
                                  : nothing}
                          `
                        : html`
                              <p class="muted">
                                  ${inputs.isLoadFailed ? 'Failed to load.' : 'Loading…'}
                              </p>
                          `}
                    ${selectedLayer ? renderLayerDetails(selectedLayer) : nothing}
                    <div class="controls">
                        ${details?.magneticDipole
                            ? html`
                                  <div class="slider-field">
                                      <span>
                                          Magnetic field and solar wind:
                                          ${Math.round(inputs.magneticFieldOpacity * 100)}%
                                      </span>
                                      <${VirSlider.assign({
                                          value: inputs.magneticFieldOpacity,
                                          label: 'Magnetic field and solar wind opacity',
                                          step: 0.02,
                                      })}
                                          ${listen(VirSlider.events.valueChange, (event) => {
                                              dispatch(
                                                  new events.magneticFieldOpacityChange({
                                                      detail: event.detail,
                                                  }),
                                              );
                                          })}
                                      ></${VirSlider}>
                                  </div>
                              `
                            : nothing}
                        <div class="slider-field">
                            <span>Time speed: ${formatTimeSpeed(timeSpeed)}</span>
                            <${VirSlider.assign({
                                value: inputs.timeSpeedPosition,
                                label: 'Time speed',
                                valueText: formatTimeSpeed(timeSpeed),
                            })}
                                ${listen(VirSlider.events.valueChange, (event) => {
                                    dispatch(
                                        new events.timeSpeedPositionChange({
                                            detail: event.detail,
                                        }),
                                    );
                                })}
                            ></${VirSlider}>
                        </div>
                    </div>
                    ${inputs.readout ? renderReadout(inputs.readout) : nothing}
                </div>
            </div>
        `;
    },
});
