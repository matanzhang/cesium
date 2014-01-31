/*global define*/
define(['../Core/Color',
        '../Core/ColorGeometryInstanceAttribute',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/defineProperties',
        '../Core/DeveloperError',
        '../Core/EllipseGeometry',
        '../Core/EllipseOutlineGeometry',
        '../Core/Event',
        '../Core/GeometryInstance',
        '../Core/Iso8601',
        '../Core/ShowGeometryInstanceAttribute',
        '../DynamicScene/ColorMaterialProperty',
        '../DynamicScene/ConstantProperty',
        '../DynamicScene/GeometryBatchType',
        '../Scene/MaterialAppearance',
        '../Scene/PerInstanceColorAppearance'
    ], function(
        Color,
        ColorGeometryInstanceAttribute,
        defaultValue,
        defined,
        defineProperties,
        DeveloperError,
        EllipseGeometry,
        EllipseOutlineGeometry,
        Event,
        GeometryInstance,
        Iso8601,
        ShowGeometryInstanceAttribute,
        ColorMaterialProperty,
        ConstantProperty,
        GeometryBatchType,
        MaterialAppearance,
        PerInstanceColorAppearance) {
    "use strict";

    var defaultMaterial = new ColorMaterialProperty(new ConstantProperty(Color.WHITE));
    var defaultShow = new ConstantProperty(true);
    var defaultFill = new ColorMaterialProperty(true);
    var defaultOutline = new ConstantProperty(false);
    var defaultOutlineColor = new ConstantProperty(Color.BLACK);

    var GeometryOptions = function(dynamicObject) {
        this.id = dynamicObject;
        this.vertexFormat = undefined;
        this.center = undefined;
        this.semiMajorAxis = undefined;
        this.semiMinorAxis = undefined;
        this.rotation = undefined;
        this.height = undefined;
        this.extrudedHeight = undefined;
        this.granularity = undefined;
        this.stRotation = undefined;
        this.numberOfVerticalLines = undefined;
    };

    var EllipseGeometryUpdater = function(dynamicObject) {
        if (!defined(dynamicObject)) {
            throw new DeveloperError('dynamicObject is required');
        }

        this._id = dynamicObject.id;
        this._dynamicObject = dynamicObject;
        this._dynamicObjectSubscription = dynamicObject.propertyChanged.addEventListener(EllipseGeometryUpdater.prototype._onDynamicObjectPropertyChanged, this);
        this._ellipseSubscription = undefined;
        this._geometryType = GeometryBatchType.NONE;
        this._geometryChanged = new Event();
        this._showProperty = undefined;
        this._materialProperty = undefined;
        this._isOutlined = false;
        this._showOutlineProperty = undefined;
        this._outlineColorProperty = undefined;
        this._outlineGeometryChanged = new Event();
        this._options = new GeometryOptions(dynamicObject);

        this._onDynamicObjectPropertyChanged(dynamicObject, 'ellipse', dynamicObject.ellipse, undefined);
    };

    EllipseGeometryUpdater.PerInstanceColorAppearanceType = PerInstanceColorAppearance;

    EllipseGeometryUpdater.MaterialAppearanceType = MaterialAppearance;

    defineProperties(EllipseGeometryUpdater.prototype, {
        id : {
            get : function() {
                return this._id;
            }
        },
        geometryType : {
            get : function() {
                return this._geometryType;
            }
        },
        geometryChanged : {
            get : function() {
                return this._geometryChanged;
            }
        },
        showProperty : {
            get : function() {
                return this._showProperty;
            }
        },
        materialProperty : {
            get : function() {
                return this._materialProperty;
            }
        },
        isOutlined : {
            get : function() {
                return this._isOutlined;
            }
        },
        showOutlineProperty : {
            get : function() {
                return this._showOutlineProperty;
            }
        },
        outlineColorProperty : {
            get : function() {
                return this._outlineColorProperty;
            }
        },
        outlineGeometryChanged : {
            get : function() {
                return this._outlineGeometryChanged;
            }
        }
    });

    EllipseGeometryUpdater.prototype.createGeometryInstance = function(time) {
        var attributes;
        if (this._geometryType === GeometryBatchType.COLOR) {
            attributes = {
                show : new ShowGeometryInstanceAttribute(this._showProperty.getValue(time)),
                color : ColorGeometryInstanceAttribute.fromColor(defined(this._materialProperty.color) ? this._materialProperty.color.getValue(time) : Color.WHTE)
            };
        } else if (this._geometryType === GeometryBatchType.MATERIAL) {
            attributes = {
                show : new ShowGeometryInstanceAttribute(this._showProperty.getValue(time))
            };
        }

        return new GeometryInstance({
            id : this._dynamicObject,
            geometry : new EllipseGeometry(this._options),
            attributes : attributes
        });
    };

    EllipseGeometryUpdater.prototype.createOutlineGeometryInstance = function(time) {
        var attributes;
        if (this._geometryType === GeometryBatchType.COLOR) {
            attributes = {
                show : new ShowGeometryInstanceAttribute(this._showOutlineProperty.getValue(time)),
                color : ColorGeometryInstanceAttribute.fromColor(this._outlineColorProperty.getValue(time))
            };
        } else if (this._geometryType === GeometryBatchType.MATERIAL) {
            attributes = {
                show : new ShowGeometryInstanceAttribute(this._showOutlineProperty.getValue(time))
            };
        }

        return new GeometryInstance({
            id : this._dynamicObject,
            geometry : new EllipseOutlineGeometry(this._options),
            attributes : attributes
        });
    };

    EllipseGeometryUpdater.prototype._onDynamicObjectPropertyChanged = function(dynamicObject, propertyName, newValue, oldValue) {
        if (propertyName === 'ellipse') {
            if (defined(oldValue)) {
                this._ellipseSubscription();
            }

            this._ellipse = newValue;

            if (defined(newValue)) {
                this._ellipseSubscription = newValue.propertyChanged.addEventListener(EllipseGeometryUpdater.prototype._update, this);
            }

            this._update();
        } else if (propertyName === 'position') {
            this._update();
        }
    };

    EllipseGeometryUpdater.prototype._update = function() {
        var ellipse = this._dynamicObject.ellipse;
        var oldGeometryType = this._geometryType;

        if (!defined(ellipse)) {
            if (this._geometryType !== GeometryBatchType.NONE) {
                this._geometryType = GeometryBatchType.NONE;
                this._geometryChanged.raiseEvent(this._geometryType, oldGeometryType);
            }
            if(this._isOutlined){
                this._isOutlined = false;
                this._outlineGeometryChanged.raiseEvent(this._isOutlined);
            }
            return;
        }

        var fillProperty = ellipse.fill;
        var isFilled = defined(fillProperty) && fillProperty.isConstant ? fillProperty.getValue(Iso8601.MINIMUM_VALUE) : true;

        var outlineProperty = ellipse.outline;
        var isOutlined = defined(outlineProperty);
        if (isOutlined && outlineProperty.isConstant) {
            isOutlined = outlineProperty.getValue(Iso8601.MINIMUM_VALUE);
        }

        if (!isFilled && !isOutlined) {
            return;
        }

        var position = this._dynamicObject.position;
        var semiMajorAxis = ellipse.semiMajorAxis;
        var semiMinorAxis = ellipse.semiMinorAxis;

        var show = ellipse.show;
        if ((defined(show) && show.isConstant && !show.getValue(Iso8601.MINIMUM_VALUE)) || //
            (!defined(position) || !defined(semiMajorAxis) || !defined(semiMinorAxis))) {
            if (this._geometryType !== GeometryBatchType.NONE) {
                this._geometryType = GeometryBatchType.NONE;
                this._geometryChanged.raiseEvent(this._geometryType, oldGeometryType);
            }
            if (this._isOutlined) {
                this._isOutlined = false;
                this._outlineGeometryChanged.raiseEvent(this._isOutlined);
            }
            return;
        }

        var material = defaultValue(ellipse.material, defaultMaterial);
        var isColorMaterial = material instanceof ColorMaterialProperty;
        this._materialProperty = material;
        this._showProperty = defaultValue(show, defaultShow);
        this._showOutlineProperty = defaultValue(ellipse.outline, defaultOutline);
        this._outlineColorProperty = defaultValue(ellipse.outlineColor, defaultOutlineColor);

        var rotation = ellipse.rotation;
        var height = ellipse.height;
        var extrudedHeight = ellipse.extrudedHeight;
        var granularity = ellipse.granularity;
        var stRotation = ellipse.stRotation;

        if (!position.isConstant || //
            !semiMajorAxis.isConstant || //
            !semiMinorAxis.isConstant || //
            defined(rotation) && !rotation.isConstant || //
            defined(height) && !height.isConstant || //
            defined(extrudedHeight) && !extrudedHeight.isConstant || //
            defined(granularity) && !granularity.isConstant || //
            defined(stRotation) && !stRotation.isConstant) {
            if (this._geometryType !== GeometryBatchType.DYNAMIC) {
                this._geometryType = GeometryBatchType.DYNAMIC;
                this._geometryChanged.raiseEvent(this._geometryType, oldGeometryType);
            }
        } else {
            var options = this._options;
            options.vertexFormat = isColorMaterial ? PerInstanceColorAppearance.VERTEX_FORMAT : MaterialAppearance.VERTEX_FORMAT;
            options.center = position.getValue(Iso8601.MINIMUM_VALUE, options.center);
            options.semiMajorAxis = semiMajorAxis.getValue(Iso8601.MINIMUM_VALUE, options.semiMajorAxis);
            options.semiMinorAxis = semiMinorAxis.getValue(Iso8601.MINIMUM_VALUE, options.semiMinorAxis);
            options.rotation = defined(rotation) ? rotation.getValue(Iso8601.MINIMUM_VALUE, options.rotation) : undefined;
            options.height = defined(height) ? height.getValue(Iso8601.MINIMUM_VALUE, options.height) : undefined;
            options.extrudedHeight = defined(extrudedHeight) ? extrudedHeight.getValue(Iso8601.MINIMUM_VALUE, options.extrudedHeight) : undefined;
            options.granularity = defined(granularity) ? granularity.getValue(Iso8601.MINIMUM_VALUE, options.granularity) : undefined;
            options.stRotation = defined(stRotation) ? stRotation.getValue(Iso8601.MINIMUM_VALUE, options.stRotation) : undefined;

            if (isFilled) {
                this._geometryType = isColorMaterial ? GeometryBatchType.COLOR : GeometryBatchType.MATERIAL;
                this._geometryChanged.raiseEvent(this._geometryType, oldGeometryType);
            }
            if (isOutlined) {
                this._isOutlined = true;
                this._outlineGeometryChanged.raiseEvent(this._isOutlined);
            }
        }
    };

    return EllipseGeometryUpdater;
});