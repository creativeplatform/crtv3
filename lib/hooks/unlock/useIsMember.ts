"use client";

import { useMembershipVerification } from "./useMembershipVerification";
import { useUser } from "@/lib/wallet/react";
import { useEffect, useState } from "react";

/**
 * Hook to check if the current user has a valid Creative Membership
 * Returns true if the user holds a valid key to any of the configured locks
 */
export function useIsMember() {
    const user = useUser();
    const { isVerified, hasMembership, isLoading } = useMembershipVerification();
    const [isMember, setIsMember] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            setIsMember(hasMembership);
        }
    }, [hasMembership, isLoading]);

    return {
        isMember,
        isLoading: isLoading || (!!user && !isVerified),
    };
}
