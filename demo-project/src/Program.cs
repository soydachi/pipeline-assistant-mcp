using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Health check endpoint
app.MapGet("/health", () => new { status = "healthy", timestamp = DateTime.UtcNow })
    .WithName("HealthCheck")
    .WithOpenApi();

// Sample API endpoints
app.MapGet("/api/items", () => new[]
{
    new { id = 1, name = "Item 1", price = 10.99 },
    new { id = 2, name = "Item 2", price = 20.99 },
    new { id = 3, name = "Item 3", price = 30.99 }
})
.WithName("GetItems")
.WithOpenApi();

app.MapGet("/api/items/{id}", (int id) =>
{
    if (id <= 0) return Results.BadRequest("Invalid ID");
    return Results.Ok(new { id, name = $"Item {id}", price = id * 10.99 });
})
.WithName("GetItemById")
.WithOpenApi();

app.MapPost("/api/items", (ItemRequest item) =>
{
    if (string.IsNullOrEmpty(item.Name)) return Results.BadRequest("Name is required");
    return Results.Created($"/api/items/{item.Id}", item);
})
.WithName("CreateItem")
.WithOpenApi();

app.Run();

public record ItemRequest(int Id, string Name, decimal Price);

// Make Program class accessible for testing
public partial class Program { }
