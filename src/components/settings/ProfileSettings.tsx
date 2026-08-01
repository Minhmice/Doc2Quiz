"use client";

import { useState } from "react";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { DISPLAY_NAME_MAX_LEN, useDisplayName } from "@/components/profile/DisplayNameProvider";

export function ProfileSettings() {
  const { displayName, setDisplayName } = useDisplayName();
  const [value, setValue] = useState(displayName);
  const save = () => setDisplayName(value.trim().slice(0, DISPLAY_NAME_MAX_LEN));
  return (
    <section id="profile" aria-labelledby="profile-heading">
      <div>
        <h2 id="profile-heading" className="font-heading text-2xl font-extrabold leading-tight tracking-[-0.02em] text-foreground">Profile</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">Name shown across your personal study workspace. Username and social safety live below.</p>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={DISPLAY_NAME_MAX_LEN}
          aria-label="Display name"
          className="min-h-11 text-base"
        />
        <Button type="button" onClick={save} className="min-h-11 shrink-0">Save changes</Button>
      </div>
    </section>
  );
}
