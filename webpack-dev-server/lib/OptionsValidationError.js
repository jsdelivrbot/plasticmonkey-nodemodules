var optionsSchema = require("./optionsSchema.json");

function OptionsValidationError(validationErrors) {
	Error.call(this);
	Error.captureStackTrace(this, OptionsValidationError);
	this.name = "WebpackDevServerOptionsValidationError";
	this.message = "Invalid configuration object. " +
		"webpack-dev-server has been initialised using a configuration object that does not match the API schema.\n" +
		validationErrors.map(function(err) {
			return " - " + indent(OptionsValidationError.formatValidationError(err), "   ", false);
		}).join("\n");
	this.validationErrors = validationErrors;
}
module.exports = OptionsValidationError;

OptionsValidationError.prototype = Object.create(Error.prototype);
OptionsValidationError.prototype.constructor = OptionsValidationError;

OptionsValidationError.formatValidationError = function formatValidationError(err) {
	var dataPath = "configuration" + err.dataPath;
	switch(err.keyword) {
		case "additionalProperties":
			return dataPath + " has an unknown property '" + err.params.additionalProperty + "'. These properties are valid:\n" +
				getSchemaPartText(err.parentSchema);
		case "oneOf":
		case "anyOf":
		case "enum":
			return dataPath + " should be one of these:\n" +
				getSchemaPartText(err.parentSchema);
		case "allOf":
			return dataPath + " should be:\n" +
				getSchemaPartText(err.parentSchema);
		case "type":
			switch(err.params.type) {
				case "object":
					return dataPath + " should be an object.";
				case "array":
					return dataPath + " should be an array.";
				case "string":
					return dataPath + " should be a string.";
				case "boolean":
					return dataPath + " should be a boolean.";
				case "number":
					return dataPath + " should be a number.";
			}
			return dataPath + " should be " + err.params.type + ":\n" +
				getSchemaPartText(err.parentSchema);
		case "instanceof":
			return dataPath + " should be an instance of " + getSchemaPartText(err.parentSchema) + ".";
		case "required":
			var missingProperty = err.params.missingProperty.replace(/^\./, "");
			return dataPath + " misses the property '" + missingProperty + "'.\n" +
				getSchemaPartText(err.parentSchema, ["properties", missingProperty]);
		case "minLength":
			if(err.params.limit === 1)
				return dataPath + " should not be empty.";
			else
				return dataPath + " " + err.message;
		default:
			return dataPath + " " + err.message + " (" + JSON.stringify(err, 0, 2) + ").\n" +
				getSchemaPartText(err.parentSchema);
	}
}

function getSchemaPart(path, parents, additionalPath) {
	parents = parents || 0;
	path = path.split("/");
	path = path.slice(0, path.length - parents);
	if(additionalPath) {
		additionalPath = additionalPath.split("/");
		path = path.concat(additionalPath);
	}
	var schemaPart = optionsSchema;
	for(var i = 1; i < path.length; i++) {
		var inner = schemaPart[path[i]];
		if(inner)
			schemaPart = inner;
	}
	return schemaPart;
}

function getSchemaPartText(schemaPart, additionalPath) {
	if(additionalPath) {
		for(var i = 0; i < additionalPath.length; i++) {
			var inner = schemaPart[additionalPath[i]];
			if(inner)
				schemaPart = inner;
		}
	}
	while(schemaPart.$ref) schemaPart = getSchemaPart(schemaPart.$ref);
	var schemaText = OptionsValidationError.formatSchema(schemaPart);
	if(schemaPart.description)
		schemaText += "\n" + schemaPart.description;
	return schemaText;
}

function formatSchema(schema, prevSchemas) {
	prevSchemas = prevSchemas || [];

	function formatInnerSchema(innerSchema, addSelf) {
		if(!addSelf) return formatSchema(innerSchema, prevSchemas);
		if(prevSchemas.indexOf(innerSchema) >= 0) return "(recursive)";
		return formatSchema(innerSchema, prevSchemas.concat(schema));
	}
	switch(schema.type) {
		case "string":
			return "string";
		case "boolean":
			return "boolean";
		case "number":
			return "number";
		case "object":
			if(schema.properties) {
				var required = schema.required || [];
				return "object { " + Object.keys(schema.properties).map(function(property) {
					if(required.indexOf(property) < 0) return property + "?";
					return property;
				}).concat(schema.additionalProperties ? ["..."] : []).join(", ") + " }";
			}
			if(schema.additionalProperties) {
				return "object { <key>: " + formatInnerSchema(schema.additionalProperties) + " }";
			}
			return "object";
		case "array":
			return "[" + formatInnerSchema(schema.items) + "]";
	}
	switch(schema.instanceof) {
		case "Function":
			return "function";
		case "RegExp":
			return "RegExp";
	}
	if(schema.$ref) return formatInnerSchema(getSchemaPart(schema.$ref), true);
	if(schema.allOf) return schema.allOf.map(formatInnerSchema).join(" & ");
	if(schema.oneOf) return schema.oneOf.map(formatInnerSchema).join(" | ");
	if(schema.anyOf) return schema.anyOf.map(formatInnerSchema).join(" | ");
	if(schema.enum) return schema.enum.map(function(item) {
		return JSON.stringify(item);
	}).join(" | ");
	return JSON.stringify(schema, 0, 2);
}

function indent(str, prefix, firstLine) {
	if(firstLine) {
		return prefix + str.replace(/\n(?!$)/g, "\n" + prefix);
	} else {
		return str.replace(/\n(?!$)/g, "\n" + prefix);
	}
}

OptionsValidationError.formatSchema = formatSchema;
