import { erc20WrapAbi, ethWrapAbi, wrapperAbi } from "@deployment";

/**
 * INHERITFI: complete ABIs to simulate and send wrap. The specific entries (wrap) go together with those common to the 29
 * wrappers, which include the custom errors (e.g. SafeERC20FailedOperation, ERC20InsufficientAllowance):
 * without them viem cannot decode why the contract would reject the transaction and the message would be generic.
 */
export const erc20WrapperAbi = [...erc20WrapAbi, ...wrapperAbi] as const;
export const ethWrapperAbi = [...ethWrapAbi, ...wrapperAbi] as const;
