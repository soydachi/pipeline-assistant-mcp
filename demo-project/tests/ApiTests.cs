using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace DemoApi.Tests;

public class ApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ApiTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task HealthCheck_ReturnsHealthy()
    {
        // Act
        var response = await _client.GetAsync("/health");

        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.Equal("healthy", content?.Status);
    }

    [Fact]
    public async Task GetItems_ReturnsListOfItems()
    {
        // Act
        var response = await _client.GetAsync("/api/items");

        // Assert
        response.EnsureSuccessStatusCode();
        var items = await response.Content.ReadFromJsonAsync<Item[]>();
        Assert.NotNull(items);
        Assert.Equal(3, items.Length);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(5)]
    public async Task GetItemById_WithValidId_ReturnsItem(int id)
    {
        // Act
        var response = await _client.GetAsync($"/api/items/{id}");

        // Assert
        response.EnsureSuccessStatusCode();
        var item = await response.Content.ReadFromJsonAsync<Item>();
        Assert.NotNull(item);
        Assert.Equal(id, item.Id);
    }

    [Fact]
    public async Task GetItemById_WithInvalidId_ReturnsBadRequest()
    {
        // Act
        var response = await _client.GetAsync("/api/items/0");

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_WithValidData_ReturnsCreated()
    {
        // Arrange
        var newItem = new { Id = 10, Name = "New Item", Price = 99.99 };

        // Act
        var response = await _client.PostAsJsonAsync("/api/items", newItem);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreateItem_WithEmptyName_ReturnsBadRequest()
    {
        // Arrange
        var newItem = new { Id = 10, Name = "", Price = 99.99 };

        // Act
        var response = await _client.PostAsJsonAsync("/api/items", newItem);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private record HealthResponse(string Status, DateTime Timestamp);
    private record Item(int Id, string Name, decimal Price);
}
