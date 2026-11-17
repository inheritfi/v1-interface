import { shortAddress } from "../lib/format";

interface AddressProps {
  address: string;
}

/** Shortened address, always left to right and isolated from the surrounding text. */
export function Address({ address }: AddressProps) {
  return (
    <bdi className="ui-mono ui-address" dir="ltr" title={address}>
      {shortAddress(address)}
    </bdi>
  );
}
