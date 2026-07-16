import { useState } from 'react'
import type { FC } from 'react'

type MyButtonProps = {
    type?: 'primary'
}

export const MyButton: FC<MyButtonProps> = ({ type }) => {
    const [count, setCount] = useState(0)
    return (
        <button
            className="my-button"
            onClick={() => {
                setCount(count + 1)
            }}>
            my button hi
            <br /> type: {type}
            <br /> count: {count}
        </button>
    )
}
