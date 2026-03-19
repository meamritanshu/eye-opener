import json
from collections.abc import Generator

from services.architect import graph
from services.state import AgentState, initial_state


def _to_sse(payload: dict[str, object]) -> str:
    return f"data: {json.dumps(payload)}\n\n"


def run_pipeline(raw_input: str) -> Generator[str, None, None]:
    from services.cache import get_cached_state, set_cached_state

    state = initial_state(raw_input)
    final_state: AgentState = state

    cached_state = get_cached_state(raw_input)
    if cached_state:
        yield _to_sse({
            "active_agent": cached_state.get("active_agent", "architect"),
            "event_type": "complete",
            "state": cached_state,
        })
        return

    try:
        for event in graph.stream(state):
            if not event:
                continue

            node_name = list(event.keys())[0]
            node_state = event[node_name]
            final_state = node_state
            payload = {
                "active_agent": node_state.get("active_agent", node_name),
                "event_type": "step",
                "state_snapshot": node_state,
            }
            yield _to_sse(payload)

        if not final_state.get("error"):
            set_cached_state(raw_input, final_state)

        yield _to_sse(
            {
                "active_agent": final_state.get("active_agent", "architect"),
                "event_type": "error" if final_state.get("error") else "complete",
                "state": final_state,
            }
        )
    except Exception as exc:
        yield _to_sse(
            {
                "active_agent": "error_handler",
                "event_type": "error",
                "message": str(exc),
            }
        )


def stream_pipeline(raw_input: str) -> Generator[dict[str, object], None, None]:
    from services.cache import get_cached_state, set_cached_state

    cached_state = get_cached_state(raw_input)
    if cached_state:
        yield {
            "active_agent": cached_state.get("active_agent", "architect"),
            "event_type": "complete",
            "state": cached_state,
        }
        return

    final_state = initial_state(raw_input)
    try:
        for event in graph.stream(final_state):
            if not event:
                continue
            node_name = list(event.keys())[0]
            node_state = event[node_name]
            final_state = node_state
            yield {
                "active_agent": node_state.get("active_agent", node_name),
                "event_type": "step",
                "state": node_state,
            }

        if not final_state.get("error"):
            set_cached_state(raw_input, final_state)

        yield {
            "active_agent": final_state.get("active_agent", "architect"),
            "event_type": "complete",
            "state": final_state,
        }
    except Exception as exc:
        yield {
            "active_agent": "error_handler",
            "event_type": "error",
            "message": str(exc),
            "state": final_state,
        }


def run_pipeline_once(raw_input: str) -> AgentState:
    final_state = initial_state(raw_input)
    for event in stream_pipeline(raw_input):
        candidate = event.get("state")
        if isinstance(candidate, dict):
            final_state = candidate
    return final_state