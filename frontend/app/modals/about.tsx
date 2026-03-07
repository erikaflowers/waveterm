// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import Logo from "@/app/asset/logo.svg";
import { modalsModel } from "@/app/store/modalmodel";
import { Modal } from "./modal";

import { isDev } from "@/util/isdev";
import { useState } from "react";
import { getApi } from "../store/global";

interface AboutModalVProps {
    versionString: string;
    updaterChannel: string;
    onClose: () => void;
}

const AboutModalV = ({ versionString, updaterChannel, onClose }: AboutModalVProps) => {
    const currentDate = new Date();

    return (
        <Modal className="pt-[34px] pb-[34px]" onClose={onClose}>
            <div className="flex flex-col gap-[26px] w-full">
                <div className="flex flex-col items-center justify-center gap-4 self-stretch w-full text-center">
                    <Logo />
                    <div className="text-[25px]">Terminus</div>
                    <div className="leading-5">
                        A Terminal Multiplexer
                        <br />
                        Built for the Crew
                    </div>
                </div>
                <div className="items-center gap-4 self-stretch w-full text-center">
                    Client Version {versionString}
                    <br />
                    Update Channel: {updaterChannel}
                </div>
                <div className="items-center gap-4 self-stretch w-full text-center">
                    &copy; {currentDate.getFullYear()} Matilda
                </div>
            </div>
        </Modal>
    );
};

AboutModalV.displayName = "AboutModalV";

const AboutModal = () => {
    const [details] = useState(() => getApi().getAboutModalDetails());
    const [updaterChannel] = useState(() => getApi().getUpdaterChannel());
    const versionString = `${details.version} (${isDev() ? "dev-" : ""}${details.buildTime})`;

    return (
        <AboutModalV
            versionString={versionString}
            updaterChannel={updaterChannel}
            onClose={() => modalsModel.popModal()}
        />
    );
};

AboutModal.displayName = "AboutModal";

export { AboutModal, AboutModalV };
