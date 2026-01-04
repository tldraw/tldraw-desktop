import { useRef } from 'react'

function useIdentity<T>(value: T, isEqual: (a: T, b: T) => boolean): T {
	const ref = useRef(value)
	if (isEqual(value, ref.current)) {
		return ref.current
	}
	ref.current = value
	return value
}

const areNullableArraysShallowEqual = (
	a: readonly any[] | null | undefined,
	b: readonly any[] | null | undefined
) => {
	a ??= null
	b ??= null
	if (a === b) {
		return true
	}
	if (!a || !b) {
		return false
	}
	return areArraysShallowEqual(a, b)
}

/** @internal */
export function useShallowArrayIdentity<T extends readonly any[] | null | undefined>(arr: T): T {
	return useIdentity(arr, areNullableArraysShallowEqual)
}

const areNullableObjectsShallowEqual = (
	a: object | null | undefined,
	b: object | null | undefined
) => {
	a ??= null
	b ??= null
	if (a === b) {
		return true
	}
	if (!a || !b) {
		return false
	}
	return areObjectsShallowEqual(a, b)
}

/** @internal */
export function useShallowObjectIdentity<T extends object | null | undefined>(obj: T): T {
	return useIdentity(obj, areNullableObjectsShallowEqual)
}

/** @internal */
export function areObjectsShallowEqual<T extends object>(obj1: T, obj2: T): boolean {
	if (obj1 === obj2) return true
	const keys1 = new Set(Object.keys(obj1))
	const keys2 = new Set(Object.keys(obj2))
	if (keys1.size !== keys2.size) return false
	for (const key of keys1) {
		if (!keys2.has(key)) return false
		if (!Object.is((obj1 as any)[key], (obj2 as any)[key])) return false
	}
	return true
}

/** @internal */
export function areArraysShallowEqual<T>(arr1: readonly T[], arr2: readonly T[]): boolean {
	if (arr1 === arr2) return true
	if (arr1.length !== arr2.length) return false
	for (let i = 0; i < arr1.length; i++) {
		if (!Object.is(arr1[i], arr2[i])) {
			return false
		}
	}
	return true
}
