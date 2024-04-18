import React from 'react';
import { Heading } from "@chakra-ui/react";
import VideoCardGrid from "../Videos/VideoCardGrid";

function TopChart() {
    return (
        <section>
            <Heading>Favorite Videos</Heading>
            <VideoCardGrid videos={[]} />
        </section>
    )
}