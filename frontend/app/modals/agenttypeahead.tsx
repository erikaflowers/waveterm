// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { agentsAtom, forceRestartWithAgent, getAgentPrefs, setAgentPref, type AgentInfo } from "@/app/store/agents";
import { globalStore, WOS } from "@/app/store/global";
import { globalRefocusWithTimeout } from "@/app/store/keymodel";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { TypeAheadModal } from "@/app/modals/typeaheadmodal";
import { NodeModel } from "@/layout/index";
import * as keyutil from "@/util/keyutil";
import * as jotai from "jotai";
import * as React from "react";

function createAgentSuggestionItems(
    agents: AgentInfo[],
    currentAgent: string,
    filterText: string
): SuggestionConnectionItem[] {
    const filtered = agents.filter((a) => {
        const searchStr = `${a.name} ${a.role}`.toLowerCase();
        return searchStr.includes(filterText.toLowerCase());
    });
    return filtered.map((agent) => ({
        status: "connected" as ConnStatusType,
        icon: "circle",
        iconColor: agent.color,
        value: agent.name,
        label: `${agent.name} — ${agent.role}`,
        current: agent.name.toLowerCase() === currentAgent?.toLowerCase(),
    }));
}

const ChangeAgentBlockModal = React.memo(
    ({
        blockId,
        blockRef,
        agentBtnRef,
        changeAgentModalAtom,
        nodeModel,
    }: {
        blockId: string;
        blockRef: React.RefObject<HTMLDivElement>;
        agentBtnRef: React.RefObject<HTMLDivElement>;
        changeAgentModalAtom: jotai.PrimitiveAtom<boolean>;
        nodeModel: NodeModel;
    }) => {
        const [filterText, setFilterText] = React.useState("");
        const changeAgentModalOpen = jotai.useAtomValue(changeAgentModalAtom);
        const [blockData] = WOS.useWaveObjectValue<Block>(WOS.makeORef("block", blockId));
        const isNodeFocused = jotai.useAtomValue(nodeModel.isFocused);
        const currentAgent = blockData?.meta?.["agent:name"] as string;
        const agents = jotai.useAtomValue(agentsAtom);
        const [rowIndex, setRowIndex] = React.useState(0);

        const changeAgent = React.useCallback(
            async (agentName: string) => {
                if (agentName === currentAgent) {
                    return;
                }

                // Save outgoing agent's current prefs
                if (currentAgent) {
                    const currentTheme = blockData?.meta?.["term:theme"] as string;
                    const currentBgColor = blockData?.meta?.["term:bgcolor"] as string;
                    if (currentTheme) {
                        await setAgentPref(currentAgent, "term:theme", currentTheme);
                    }
                    if (currentBgColor) {
                        await setAgentPref(currentAgent, "term:bgcolor", currentBgColor);
                    }
                }

                // Look up incoming agent + saved prefs
                const agentInfo = agents.find((a) => a.name === agentName);
                const savedPrefs = agentName ? getAgentPrefs(agentName) : {};

                const meta: Record<string, any> = {
                    "agent:name": agentName || null,
                    "agent:color": agentInfo?.color || null,
                    "agent:role": agentInfo?.role || null,
                    "term:theme": savedPrefs["term:theme"] ?? agentInfo?.defaultTheme ?? null,
                    "term:bgcolor": savedPrefs["term:bgcolor"] ?? null,
                };
                await RpcApi.SetMetaCommand(TabRpcClient, {
                    oref: WOS.makeORef("block", blockId),
                    meta,
                });

                // ForceRestart the terminal into the agent's tmux session (or bare shell)
                await forceRestartWithAgent(blockId, agentName || null);
            },
            [blockId, currentAgent, agents, blockData]
        );

        const clearItem: SuggestionConnectionItem = {
            status: "connected" as ConnStatusType,
            icon: "xmark",
            iconColor: "var(--grey-text-color)",
            value: "",
            label: "No Agent",
            current: !currentAgent,
        };

        const agentItems = createAgentSuggestionItems(agents, currentAgent, filterText);

        const suggestions: SuggestionsType[] = [];
        if ("no agent".includes(filterText.toLowerCase()) || filterText === "") {
            suggestions.push(clearItem);
        }
        if (agentItems.length > 0) {
            suggestions.push({
                headerText: "Agents",
                items: agentItems,
            });
        }

        let selectionList: SuggestionConnectionItem[] = suggestions.flatMap((item) => {
            if ("items" in item) {
                return item.items;
            }
            return item;
        });

        selectionList = selectionList.map((item, index) => {
            if (index === rowIndex && item.iconColor === "var(--grey-text-color)") {
                item.iconColor = "var(--main-text-color)";
            }
            return item;
        });

        const handleTypeAheadKeyDown = React.useCallback(
            (waveEvent: WaveKeyboardEvent): boolean => {
                if (keyutil.checkKeyPressed(waveEvent, "Enter")) {
                    const rowItem = selectionList[rowIndex];
                    if (rowItem) {
                        changeAgent(rowItem.value);
                        globalStore.set(changeAgentModalAtom, false);
                        globalRefocusWithTimeout(10);
                    }
                    setRowIndex(0);
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "Escape")) {
                    globalStore.set(changeAgentModalAtom, false);
                    setFilterText("");
                    globalRefocusWithTimeout(10);
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "ArrowUp")) {
                    setRowIndex((idx) => Math.max(idx - 1, 0));
                    return true;
                }
                if (keyutil.checkKeyPressed(waveEvent, "ArrowDown")) {
                    setRowIndex((idx) => Math.min(idx + 1, selectionList.length - 1));
                    return true;
                }
                setRowIndex(0);
                return false;
            },
            [changeAgentModalAtom, blockId, filterText, selectionList]
        );

        React.useEffect(() => {
            setRowIndex((idx) => Math.min(idx, selectionList.length - 1));
        }, [selectionList, setRowIndex]);

        if (!changeAgentModalOpen) {
            return null;
        }

        return (
            <TypeAheadModal
                blockRef={blockRef}
                anchorRef={agentBtnRef}
                suggestions={suggestions}
                onSelect={(selected: string) => {
                    changeAgent(selected);
                    globalStore.set(changeAgentModalAtom, false);
                    globalRefocusWithTimeout(10);
                }}
                selectIndex={rowIndex}
                autoFocus={isNodeFocused}
                onKeyDown={(e) => keyutil.keydownWrapper(handleTypeAheadKeyDown)(e)}
                onChange={(current: string) => setFilterText(current)}
                value={filterText}
                label="Select agent..."
                onClickBackdrop={() => globalStore.set(changeAgentModalAtom, false)}
            />
        );
    }
);

export { ChangeAgentBlockModal };
