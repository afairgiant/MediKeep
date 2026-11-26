"""Read-side copies of input schemas, so stored rows always serialize."""

import copy
import functools
import types
import typing
from typing import Annotated, Any, Callable

import annotated_types
from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    EmailStr,
    create_model,
    field_validator,
    model_validator,
)
from pydantic.fields import FieldInfo

# Format-checked types that a stored value can fail, read back as their plain type
LENIENT_TYPES: dict = {EmailStr: str}

LENIENT_MARKER = "__read_model_lenient__"

# Models whose read copy is under construction; a self-reference keeps the original
_BUILDING: list = []


def _lenient(func: Callable) -> Callable:
    """Wrap a validator to return its first argument unchanged when it raises."""

    def wrapper(*args):
        try:
            return func(*args)
        except Exception:  # pylint: disable=broad-exception-caught
            return args[0]

    # The copied signature is what pydantic reads to decide whether to pass info
    wrapped = functools.update_wrapper(wrapper, func, updated=())
    setattr(wrapped, LENIENT_MARKER, True)
    return wrapped


def _lenient_metadata(metadata: list) -> list:
    """Validators from ``metadata`` made lenient, with constraints dropped.

    Raises:
        TypeError: on any other metadata, such as a plain/wrap validator or a
            serializer, which a read copy cannot carry over faithfully.
    """
    kept = []
    for item in metadata:
        if isinstance(item, (AfterValidator, BeforeValidator)):
            kept.append(type(item)(_lenient(item.func)))
        elif isinstance(item, FieldInfo) and item.discriminator is None:
            kept.extend(_lenient_metadata(item.metadata))
        elif not isinstance(item, annotated_types.BaseMetadata):
            raise TypeError(f"read_model cannot make a {type(item).__name__} lenient")
    return kept


def _has_serializers(model: type[BaseModel]) -> bool:
    decorators = model.__pydantic_decorators__
    return bool(
        decorators.field_serializers
        or decorators.model_serializers
        or decorators.computed_fields
    )


def _read_nested_model(model: type[BaseModel]) -> type[BaseModel]:
    if _BUILDING and model is _BUILDING[-1]:
        return model
    if model in _BUILDING:
        raise TypeError(
            f"read_model cannot copy mutually recursive model {model.__name__}"
        )
    if _has_serializers(model):
        return model
    return read_model(model)


def _read_annotation(annotation: Any) -> Any:
    """Lenient form of ``annotation``: nested models become read copies, format
    types become their plain type, and nested constraints are dropped.

    Raises:
        TypeError: if ``annotation`` refers back to a model whose read copy is
            still being built, other than the model itself.
    """
    if isinstance(annotation, type):
        if annotation in LENIENT_TYPES:
            return LENIENT_TYPES[annotation]
        if issubclass(annotation, BaseModel):
            return _read_nested_model(annotation)
    origin = typing.get_origin(annotation)
    args = typing.get_args(annotation)
    if origin is Annotated:
        inner = _read_annotation(args[0])
        validators = _lenient_metadata(list(args[1:]))
        return Annotated[(inner, *validators)] if validators else inner
    if origin in (None, typing.Literal) or not args:
        return annotation
    new_args = tuple(_read_annotation(arg) for arg in args)
    if new_args == args:
        return annotation
    rebuild = typing.Union if origin in (typing.Union, types.UnionType) else origin
    return rebuild[new_args]


def _read_field(info: FieldInfo) -> tuple:
    if info.discriminator is not None:
        raise TypeError("read_model cannot copy a discriminated union field")
    field = copy.copy(info)
    field.metadata = _lenient_metadata(info.metadata)
    return _read_annotation(info.annotation), field


@functools.cache
def read_model(base: type[BaseModel]) -> type[BaseModel]:
    """Copy of ``base`` for serializing stored rows: same fields, types and defaults.

    Length, range and strictness constraints are dropped, format types such as
    ``EmailStr`` become ``str``, and every validator still runs but returns its
    input unchanged instead of raising, so a validator that fails also skips any
    normalization it would have applied. Nested models in field types are
    replaced by their own read copies, except models carrying serializers.
    Validators defined on the subclass that inherits from the copy are left as
    written.

    Raises:
        TypeError: if ``base`` carries a serializer, computed field, plain/wrap
            validator, discriminator or other metadata this copy cannot carry
            over faithfully, or is mutually recursive with a nested model.
    """
    if _has_serializers(base):
        raise TypeError(f"read_model cannot copy serializers from {base.__name__}")
    _BUILDING.append(base)
    try:
        return _build_read_model(base)
    finally:
        _BUILDING.pop()


def _build_read_model(base: type[BaseModel]) -> type[BaseModel]:
    decorators = base.__pydantic_decorators__
    validators = {}
    # Bound classmethods go in as staticmethods so pydantic does not bind cls twice
    for name, dec in decorators.field_validators.items():
        if dec.info.mode not in ("before", "after"):
            raise TypeError(f"read_model cannot make {base.__name__}.{name} lenient")
        validators[name] = field_validator(
            *dec.info.fields, mode=dec.info.mode, check_fields=False
        )(staticmethod(_lenient(getattr(base, name))))
    for name, dec in decorators.model_validators.items():
        func = _lenient(getattr(base, name))
        if dec.info.mode == "before":
            func = staticmethod(func)
        elif dec.info.mode != "after":
            raise TypeError(f"read_model cannot make {base.__name__}.{name} lenient")
        validators[name] = model_validator(mode=dec.info.mode)(func)

    fields = {name: _read_field(info) for name, info in base.model_fields.items()}
    return create_model(
        f"{base.__name__}Read",
        # Attribute reads let a nested copy accept instances of the original model
        __config__={**base.model_config, "from_attributes": True},
        __module__=base.__module__,
        __validators__=validators,
        **fields,
    )
